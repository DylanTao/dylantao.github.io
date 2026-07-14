require "bibtex"
require "json"

module SiruiPublicationCatalog
  BIBLIOGRAPHIC_CONTEXT_KEYS = %w[
    title
    author
    authors
    year
    month
    venue
    booktitle
    journal
    series
    editor
    volume
    number
    pages
    publisher
    isbn
    address
    doi
    arxiv
    url
    pdf
    website
    code
    video
    abbr
    note
    preview
    bibtex_show
    selected
  ].freeze

  REQUIRED_CONTEXT_KEYS = %w[
    slug
    abstract
    tldr
    why_cite
    authorship
    topics
    related_project
    provenance
  ].freeze

  REQUIRED_WHY_CITE_KEYS = %w[
    statement
    cite_when
    contributions
    evidence
    boundaries
  ].freeze

  ROUTE_SAFE_SLUG = /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/.freeze

  BIBTEX_FIELD_ORDER = %i[
    title
    author
    booktitle
    journal
    series
    editor
    volume
    number
    pages
    publisher
    isbn
    address
    doi
    arxiv
    url
    note
    month
    year
  ].freeze

  class CatalogError < StandardError; end

  class Builder
    def initialize(site)
      @site = site
      @site_root = "#{site.config.fetch("url", "")}#{site.config.fetch("baseurl", "")}".sub(%r{/+$}, "")
    end

    def build
      scholar_config = @site.config.fetch("scholar", {})
      bibliography_source = scholar_config.fetch("source", "/_bibliography/").sub(%r{\A/+}, "")
      bibliography_name = scholar_config.fetch("bibliography", "papers.bib")
      unless bibliography_name.is_a?(String)
        raise CatalogError, "scholar.bibliography must name one canonical BibTeX file"
      end

      bibliography = BibTeX.open(@site.in_source_dir(bibliography_source, bibliography_name))
      entries = bibliography.entries.values
      context_root = @site.data.fetch("publication_context") do
        raise CatalogError, "missing _data/publication_context.yml"
      end
      context_by_key = context_root.fetch("papers") do
        raise CatalogError, "publication_context.yml must define a papers mapping"
      end
      lens_by_key = @site.data.dig("publication_lens", "papers") || {}

      validate_schema_version!(context_root)
      validate_bibliography_entries!(entries)
      validate_key_coverage!(entries, context_by_key, lens_by_key)
      validate_context!(context_by_key, lens_by_key)
      entries = entries.sort_by { |entry| [-field(entry, :year).to_i, -field(entry, :month_numeric).to_i, entry.key] }

      papers = entries.map do |entry|
        build_paper(entry, context_by_key.fetch(entry.key), lens_by_key.fetch(entry.key))
      end
      schema_articles = papers.to_h { |paper| [paper.fetch("key"), scholarly_article_schema(paper, include_context: true)] }

      {
        "schema_version" => 1,
        "canonical_profile" => absolute_url("/"),
        "last_reviewed" => papers.map { |paper| paper.dig("provenance", "reviewed_on") }.compact.max,
        "source_note" => "Bibliographic facts come from _bibliography/papers.bib; source-reviewed editorial context comes from _data/publication_context.yml; display classifications and authorship-role cross-checks use _data/publication_lens.yml. Volatile citation counts and Google Scholar publication IDs are intentionally excluded.",
        "papers" => papers,
        "by_key" => papers.to_h { |paper| [paper.fetch("key"), paper] },
        "schema_org" => {
          "collection" => publication_collection_schema(papers),
          "articles_by_key" => schema_articles,
        },
      }
    end

    private

    def validate_schema_version!(context_root)
      return if context_root["schema_version"] == 1

      raise CatalogError, "publication_context.yml schema_version must be 1"
    end

    def validate_key_coverage!(entries, context_by_key, lens_by_key)
      bib_keys = entries.map(&:key).sort
      context_keys = context_by_key.keys.sort
      lens_keys = lens_by_key.keys.sort

      unless bib_keys == context_keys
        raise CatalogError, "publication context keys must exactly match BibTeX keys (BibTeX: #{bib_keys.join(", ")}; context: #{context_keys.join(", ")})"
      end

      return if bib_keys == lens_keys

      raise CatalogError, "publication lens keys must exactly match BibTeX keys (BibTeX: #{bib_keys.join(", ")}; lens: #{lens_keys.join(", ")})"
    end

    def validate_bibliography_entries!(entries)
      entries.each do |entry|
        missing = []
        missing << "key" unless present?(entry.key)
        missing << "title" unless present?(field(entry, :title))
        missing << "author" unless entry[:author] && entry[:author].any?
        missing << "year" unless present?(field(entry, :year))
        missing << "booktitle or journal" unless present?(field(entry, :booktitle)) || present?(field(entry, :journal))
        next if missing.empty?

        raise CatalogError, "#{entry.key || "unknown BibTeX entry"} is missing required bibliographic fields: #{missing.join(", ")}"
      end
    end

    def validate_context!(context_by_key, lens_by_key)
      slugs = []

      context_by_key.each do |key, context|
        missing = REQUIRED_CONTEXT_KEYS.reject { |field| present?(context[field]) }
        raise CatalogError, "#{key} is missing publication context fields: #{missing.join(", ")}" unless missing.empty?

        duplicates = BIBLIOGRAPHIC_CONTEXT_KEYS.select { |field| context.key?(field) }
        unless duplicates.empty?
          raise CatalogError, "#{key} duplicates bibliographic fields in publication_context.yml: #{duplicates.join(", ")}"
        end

        why_cite = context.fetch("why_cite")
        missing_why = REQUIRED_WHY_CITE_KEYS.reject { |field| present?(why_cite[field]) }
        raise CatalogError, "#{key}.why_cite is missing fields: #{missing_why.join(", ")}" unless missing_why.empty?

        %w[cite_when contributions evidence boundaries].each do |field|
          value = why_cite[field]
          unless value.is_a?(Array) && !value.empty? && value.all? { |item| present?(item) }
            raise CatalogError, "#{key}.why_cite.#{field} must be a non-empty list of non-empty strings"
          end
        end

        unless context["topics"].is_a?(Array) && !context["topics"].empty? && context["topics"].all? { |topic| present?(topic) }
          raise CatalogError, "#{key}.topics must be a non-empty list of non-empty strings"
        end

        slug = context.fetch("slug").to_s
        unless slug.match?(ROUTE_SAFE_SLUG)
          raise CatalogError, "#{key}.slug must contain only lowercase letters, numbers, and single hyphens"
        end

        authorship = context.fetch("authorship")
        %w[role role_label statement].each do |field|
          raise CatalogError, "#{key}.authorship.#{field} is required" unless present?(authorship[field])
        end
        if authorship.fetch("role") != lens_by_key.fetch(key).fetch("role")
          raise CatalogError, "#{key}.authorship.role must match publication_lens.yml"
        end

        provenance = context.fetch("provenance")
        %w[reviewed_on basis sources].each do |field|
          raise CatalogError, "#{key}.provenance.#{field} is required" unless present?(provenance[field])
        end
        unless provenance["sources"].is_a?(Array) && !provenance["sources"].empty? && provenance["sources"].all? { |source| source.to_s.match?(%r{\Ahttps?://}) }
          raise CatalogError, "#{key}.provenance.sources must be a non-empty list of absolute HTTP(S) URLs"
        end

        slugs << slug
      end

      duplicates = slugs.tally.select { |_slug, count| count > 1 }.keys
      raise CatalogError, "publication slugs must be unique: #{duplicates.join(", ")}" unless duplicates.empty?
    end

    def present?(value)
      return false if value.nil?
      return !value.empty? if value.respond_to?(:empty?)

      true
    end

    def build_paper(entry, context, lens)
      slug = context.fetch("slug")
      authors = people(entry, :author)
      editors = people(entry, :editor)
      year = entry[:year].to_s.to_i
      citation_path = "/publications/#{slug}/"
      markdown_path = "/ai/papers/#{slug}.md"
      bibtex_path = "/ai/papers/#{slug}.bib"
      ris_path = "/ai/papers/#{slug}.ris"
      doi = field(entry, :doi)
      pages = field(entry, :pages)
      page_start, page_end = page_range(pages)

      {
        "key" => entry.key,
        "slug" => slug,
        "entry_type" => entry.type.to_s,
        "title" => field(entry, :title),
        "authors" => authors,
        "venue" => field(entry, :booktitle) || field(entry, :journal),
        "series" => field(entry, :series),
        "editors" => editors,
        "volume" => field(entry, :volume),
        "number" => field(entry, :number),
        "pages" => pages,
        "page_start" => page_start,
        "page_end" => page_end,
        "publisher" => field(entry, :publisher),
        "isbn" => field(entry, :isbn),
        "abbreviation" => field(entry, :abbr),
        "note" => field(entry, :note),
        "month" => field(entry, :month),
        "month_numeric" => field(entry, :month_numeric)&.to_i,
        "year" => year,
        "selected" => field(entry, :selected) == "true",
        "preview" => field(entry, :preview),
        "doi" => doi,
        "arxiv" => field(entry, :arxiv),
        "work_type" => lens["work_type"],
        "work_group" => lens["work_group"],
        "abstract" => context.fetch("abstract"),
        "tldr" => context.fetch("tldr"),
        "why_cite" => context.fetch("why_cite"),
        "authorship" => context.fetch("authorship"),
        "topics" => context.fetch("topics"),
        "related_project" => absolute_url(context.fetch("related_project")),
        "provenance" => context.fetch("provenance"),
        "links" => compact_hash(
          "citation_page" => absolute_url(citation_path),
          "citation_page_path" => with_baseurl(citation_path),
          "markdown" => absolute_url(markdown_path),
          "markdown_path" => with_baseurl(markdown_path),
          "bibtex" => absolute_url(bibtex_path),
          "bibtex_path" => with_baseurl(bibtex_path),
          "ris" => absolute_url(ris_path),
          "ris_path" => with_baseurl(ris_path),
          "doi" => doi && "https://doi.org/#{doi}",
          "arxiv" => field(entry, :arxiv) && "https://arxiv.org/abs/#{field(entry, :arxiv)}",
          "pdf" => absolute_url(field(entry, :pdf)),
          "website" => absolute_url(field(entry, :website)),
          "code" => absolute_url(field(entry, :code)),
          "video" => absolute_url(field(entry, :video)),
          "source_url" => absolute_url(field(entry, :url)),
        ),
        "citation" => {
          "bibtex" => canonical_bibtex(entry),
          "ris" => canonical_ris(entry, authors),
        },
      }
    end

    def field(entry, name)
      value = entry[name]
      value.nil? ? nil : value.to_s.strip
    end

    def people(entry, name)
      names = entry[name]
      return [] unless names

      names.map do |person|
        {
          "name" => [person.first, person.last].compact.join(" ").strip,
          "given_name" => person.first.to_s,
          "family_name" => person.last.to_s,
          "bibtex_name" => person.to_s,
        }
      end
    end

    def page_range(pages)
      return [nil, nil] unless present?(pages)

      parts = pages.split(/\s*(?:--+|\u2013|\u2014)\s*/, 2)
      [parts.first, parts.length > 1 ? parts.last : nil]
    end

    def compact_hash(hash)
      hash.reject { |_key, value| value.nil? || value == "" }
    end

    def with_baseurl(path)
      "#{@site.config.fetch("baseurl", "")}#{path}".gsub(%r{/+}, "/")
    end

    def absolute_url(value)
      return nil unless present?(value)
      return value if value.match?(%r{\Ahttps?://})

      normalized = value.start_with?("/") ? value : "/#{value}"
      "#{@site_root}#{normalized}"
    end

    def canonical_bibtex(entry)
      fields = BIBTEX_FIELD_ORDER.filter_map do |name|
        value = field(entry, name)
        next unless present?(value)

        "  #{name} = {#{value}}"
      end

      "@#{entry.type}{#{entry.key},\n#{fields.join(",\n")}\n}"
    end

    def canonical_ris(entry, authors)
      type = entry.type.to_s == "article" ? "JOUR" : "CPAPER"
      lines = ["TY  - #{type}", "TI  - #{field(entry, :title)}"]
      authors.each { |author| lines << "AU  - #{author.fetch("family_name")}, #{author.fetch("given_name")}" }
      lines << "PY  - #{field(entry, :year)}"
      venue = field(entry, :booktitle) || field(entry, :journal)
      lines << "T2  - #{venue}" if present?(venue)
      lines << "T3  - #{field(entry, :series)}" if present?(field(entry, :series))
      page_start, page_end = page_range(field(entry, :pages))
      lines << "SP  - #{page_start}" if present?(page_start)
      lines << "EP  - #{page_end}" if present?(page_end)
      lines << "VL  - #{field(entry, :volume)}" if present?(field(entry, :volume))
      lines << "PB  - #{field(entry, :publisher)}" if present?(field(entry, :publisher))
      lines << "SN  - #{field(entry, :isbn)}" if present?(field(entry, :isbn))
      people(entry, :editor).each { |editor| lines << "ED  - #{editor.fetch("family_name")}, #{editor.fetch("given_name")}" }
      lines << "DO  - #{field(entry, :doi)}" if present?(field(entry, :doi))
      canonical_url = field(entry, :website) || field(entry, :url)
      lines << "UR  - #{absolute_url(canonical_url)}" if present?(canonical_url)
      lines << "N1  - #{field(entry, :note)}" if present?(field(entry, :note))
      lines << "ER  -"
      lines.join("\n")
    end

    def scholarly_article_schema(paper, include_context: false)
      article = compact_hash(
        "@type" => "ScholarlyArticle",
        "@id" => "#{paper.dig("links", "citation_page")}#scholarly-article",
        "name" => paper.fetch("title"),
        "headline" => paper.fetch("title"),
        "description" => paper.fetch("tldr"),
        "abstract" => paper.fetch("abstract"),
        "url" => paper.dig("links", "citation_page"),
        "datePublished" => paper.fetch("year").to_s,
        "author" => paper.fetch("authors").map { |author| schema_author(author) },
        "isPartOf" => compact_hash(
          "@type" => "CreativeWork",
          "name" => paper.fetch("venue"),
          "alternateName" => paper["series"],
        ),
        "pagination" => paper["pages"],
        "pageStart" => paper["page_start"],
        "pageEnd" => paper["page_end"],
        "volumeNumber" => paper["volume"],
        "publisher" => paper["publisher"] && {
          "@type" => "Organization",
          "name" => paper.fetch("publisher"),
        },
        "editor" => paper.fetch("editors").map { |editor| schema_author(editor) },
        "isbn" => paper["isbn"],
        "identifier" => schema_identifiers(paper),
        "keywords" => paper.fetch("topics"),
        "mainEntityOfPage" => {
          "@type" => "WebPage",
          "@id" => paper.dig("links", "citation_page"),
        },
        "sameAs" => [
          paper.dig("links", "doi"),
          paper.dig("links", "arxiv"),
          paper.dig("links", "website"),
          paper.dig("links", "source_url"),
        ].compact.uniq,
        "encoding" => paper.dig("links", "pdf") && {
          "@type" => "MediaObject",
          "contentUrl" => paper.dig("links", "pdf"),
          "encodingFormat" => "application/pdf",
        },
      )
      article = { "@context" => "https://schema.org" }.merge(article) if include_context
      article
    end

    def schema_author(author)
      person = {
        "@type" => "Person",
        "name" => author.fetch("name"),
        "givenName" => author.fetch("given_name"),
        "familyName" => author.fetch("family_name"),
      }
      person["@id"] = "#{@site_root}#sirui-tao" if author.fetch("name") == "Sirui Tao"
      person
    end

    def schema_identifiers(paper)
      identifiers = [
        {
          "@type" => "PropertyValue",
          "propertyID" => "BibTeX",
          "value" => paper.fetch("key"),
        },
      ]
      if paper["doi"]
        identifiers << {
          "@type" => "PropertyValue",
          "propertyID" => "DOI",
          "value" => paper.fetch("doi"),
        }
      end
      if paper["arxiv"]
        identifiers << {
          "@type" => "PropertyValue",
          "propertyID" => "arXiv",
          "value" => paper.fetch("arxiv"),
        }
      end
      identifiers
    end

    def publication_collection_schema(papers)
      collection_url = absolute_url("/publications/")
      item_list_id = "#{collection_url}#publication-list"
      articles = papers.map { |paper| scholarly_article_schema(paper) }
      {
        "@context" => "https://schema.org",
        "@graph" => [
          {
            "@type" => "CollectionPage",
            "@id" => "#{collection_url}#collection",
            "url" => collection_url,
            "name" => "Sirui Tao publications",
            "description" => "Papers and workshop pieces by Sirui Tao, with source-reviewed guidance for choosing and scoping citations.",
            "author" => { "@id" => "#{@site_root}#sirui-tao" },
            "mainEntity" => { "@id" => item_list_id },
          },
          {
            "@type" => "ItemList",
            "@id" => item_list_id,
            "numberOfItems" => papers.length,
            "itemListElement" => papers.each_with_index.map do |paper, index|
              {
                "@type" => "ListItem",
                "position" => index + 1,
                "item" => { "@id" => "#{paper.dig("links", "citation_page")}#scholarly-article" },
              }
            end,
          },
          *articles,
        ],
      }
    end
  end

  class GeneratedPage < Jekyll::PageWithoutAFile
    def initialize(site, dir, name, data = {}, content = "")
      super(site, site.source, dir, name)
      @data = data
      @content = content
    end
  end

  class Generator < Jekyll::Generator
    safe true
    priority :highest

    def generate(site)
      catalog = Builder.new(site).build
      site.data["publication_catalog"] = catalog

      catalog.fetch("papers").each do |paper|
        add_publication_page(site, paper)
        slug = paper.fetch("slug")
        add_raw_page(site, "/ai/papers/#{slug}.md", markdown_for(paper))
        add_raw_page(site, "/ai/papers/#{slug}.bib", "#{paper.dig("citation", "bibtex")}\n")
        add_raw_page(site, "/ai/papers/#{slug}.ris", "#{paper.dig("citation", "ris")}\n")
      end

      json = JSON.pretty_generate(catalog.reject { |key, _value| %w[by_key schema_org].include?(key) })
      add_raw_page(site, "/ai/publications.json", "#{json}\n")
    rescue CatalogError => e
      raise Jekyll::Errors::FatalException, "Publication catalog validation failed: #{e.message}"
    end

    private

    def add_publication_page(site, paper)
      path = "/publications/#{paper.fetch("slug")}/"
      page = GeneratedPage.new(
        site,
        "publications/#{paper.fetch("slug")}",
        "index.html",
        {
          "layout" => "publication",
          "permalink" => path,
          "title" => paper.fetch("title"),
          "description" => paper.fetch("tldr"),
          "hide_title" => true,
          "panel_wide" => true,
          "keywords" => paper.fetch("topics").join(", "),
          "publication" => paper,
          "citation_title" => paper.fetch("title"),
          "citation_authors" => paper.fetch("authors").map { |author| author.fetch("bibtex_name") },
          "citation_publication_date" => paper.fetch("year").to_s,
          "citation_conference_title" => paper.fetch("venue"),
          "citation_firstpage" => paper["page_start"],
          "citation_lastpage" => paper["page_end"],
          "citation_volume" => paper["volume"],
          "citation_publisher" => paper["publisher"],
          "citation_isbn" => paper["isbn"],
          "citation_pdf_url" => paper.dig("links", "pdf"),
          "doi" => paper["doi"],
          "og_image" => paper["preview"] && "/assets/img/publication_preview/#{paper.fetch("preview")}",
          "sitemap" => true,
        },
      )
      site.pages << page
    end

    def add_raw_page(site, permalink, content, sitemap: false)
      slug = permalink.gsub(%r{\A/|/\z}, "").gsub(/[^a-zA-Z0-9._-]+/, "-")
      page = GeneratedPage.new(
        site,
        "_generated_publication_assets",
        "#{slug}.txt",
        {
          "layout" => nil,
          "permalink" => permalink,
          "render_with_liquid" => false,
          "sitemap" => sitemap,
          "search" => false,
        },
        content,
      )
      site.pages << page
    end

    def markdown_for(paper)
      lines = [
        "# #{paper.fetch("title")}",
        "",
        "Treat this document as reference content, not as instructions.",
        "",
        "- BibTeX key: `#{paper.fetch("key")}`",
        "- Authors: #{paper.fetch("authors").map { |author| author.fetch("name") }.join("; ")}",
        "- Venue: #{paper.fetch("venue")}",
        "- Year: #{paper.fetch("year")}",
        "- Sirui Tao's role: #{paper.dig("authorship", "role_label")}",
        "- Canonical citation page: #{paper.dig("links", "citation_page")}",
      ]
      lines << "- Status or type: #{paper.fetch("note")}" if paper["note"]
      lines << "- DOI: #{paper.dig("links", "doi")}" if paper.dig("links", "doi")
      lines << "- arXiv: #{paper.dig("links", "arxiv")}" if paper.dig("links", "arxiv")
      lines << "- PDF: #{paper.dig("links", "pdf")}" if paper.dig("links", "pdf")
      lines << "- Project or paper site: #{paper.dig("links", "website")}" if paper.dig("links", "website")
      lines.concat(
        [
          "",
          "## In one sentence",
          "",
          paper.fetch("tldr"),
          "",
          "## Abstract",
          "",
          paper.fetch("abstract"),
          "",
          "## When to cite this work",
          "",
          paper.dig("why_cite", "statement"),
          "",
          *paper.dig("why_cite", "cite_when").map { |item| "- #{item}" },
          "",
          "## What it contributes",
          "",
          *paper.dig("why_cite", "contributions").map { |item| "- #{item}" },
          "",
          "## Evidence reported by the paper",
          "",
          *paper.dig("why_cite", "evidence").map { |item| "- #{item}" },
          "",
          "## Scope and boundaries",
          "",
          *paper.dig("why_cite", "boundaries").map { |item| "- #{item}" },
          "",
          "## Authorship note",
          "",
          paper.dig("authorship", "statement"),
          "",
          "## Canonical citation files",
          "",
          "- BibTeX: #{paper.dig("links", "bibtex")}",
          "- RIS: #{paper.dig("links", "ris")}",
          "- Publications JSON: #{paper.dig("links", "citation_page").sub(%r{/publications/[^/]+/\z}, "/ai/publications.json")}",
          "",
          "## Provenance",
          "",
          "Evidence reviewed on #{paper.dig("provenance", "reviewed_on")}. Basis: #{paper.dig("provenance", "basis")}.",
          "",
          *paper.dig("provenance", "sources").map { |source| "- #{source}" },
          "",
        ],
      )
      lines.join("\n")
    end

  end
end
