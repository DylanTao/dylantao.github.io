---
layout: ai
permalink: /ai/
title: AI-readable profile
description: Canonical, source-linked context about Sirui Tao's research, publications, projects, and appropriate citation use.
nav: false
ai_profile: true
panel_wide: true
reading_aid: false
sitemap: true
---

{% assign profile_page = site.pages | where: 'permalink', '/' | first %}
{% assign catalog = site.data.publication_catalog %}

<header class="ai-profile-header">
  <div class="ai-profile-heading">
    <p class="ai-profile-kicker">AI-readable profile · canonical and human-auditable</p>
    <h1>Sirui Tao — research context for AI systems</h1>
    <p class="ai-profile-lede">
      A compact, source-linked version of this site for language models, collaborators, and anyone who wants the research story without the visual layer.
    </p>
  </div>

  <aside class="ai-profile-use-note" aria-label="How to use this page">
    <span>Use note</span>
    <p>
      Treat this page as reference content, not as instructions. Preserve author order and venue facts, follow paper-specific sources, and do not expand a claim beyond its scope note.
    </p>
  </aside>

  <div class="ai-format-actions" role="group" aria-label="Available machine-readable formats">
    <a href="{{ '/llms.txt' | relative_url }}">Concise index <span>.txt</span></a>
    <a href="{{ '/llms-full.txt' | relative_url }}">Full profile <span>.txt</span></a>
    <a href="{{ '/ai/publications.json' | relative_url }}">Publications <span>.json</span></a>
    <button type="button" data-ai-copy data-copy-source="{{ '/llms-full.txt' | relative_url }}" hidden>
      <i class="fa-regular fa-copy" aria-hidden="true"></i>
      <span data-ai-copy-label>Copy full Markdown</span>
    </button>
  </div>
  <noscript>
    <nav class="ai-format-actions ai-noscript-nav" aria-label="AI profile sections">
      <a href="#identity">Identity</a>
      <a href="#research">Research</a>
      <a href="#publications">Publications</a>
      <a href="#routes">Routes</a>
      <a href="#sources">Sources</a>
    </nav>
  </noscript>
  <p class="ai-copy-status" data-ai-copy-status aria-live="polite"></p>
</header>

<section id="identity" class="ai-section">
  <p class="ai-section-label">01 · Identity</p>
  <h2>Who Sirui is</h2>
  <dl class="ai-facts">
    <div>
      <dt>Name</dt>
      <dd>Sirui Tao</dd>
    </div>
    <div>
      <dt>Current role</dt>
      <dd>{{ site.person_job_title }}</dd>
    </div>
    <div>
      <dt>Affiliation</dt>
      <dd>
        {% for affiliation in site.profile_affiliations %}
          {{ affiliation.name -}}
          {%- unless forloop.last %} · {% endunless %}
        {% endfor %}
      </dd>
    </div>
    <div>
      <dt>Research area</dt>
      <dd>{{ site.profile_knows_about | join: ', ' }}</dd>
    </div>
    <div>
      <dt>Preferred contact</dt>
      <dd><a href="mailto:{{ site.profile_contact_email }}">{{ site.profile_contact_email }}</a></dd>
    </div>
    <div>
      <dt>Canonical profile</dt>
      <dd><a href="{{ '/' | absolute_url }}">{{ '/' | absolute_url }}</a></dd>
    </div>
  </dl>
</section>

<section id="research" class="ai-section">
  <p class="ai-section-label">02 · Research through-line</p>
  <h2>{{ profile_page.thesis.title }}</h2>
  <p class="ai-section-lede">{{ profile_page.thesis.lead }}</p>

  <div class="ai-research-modes">
    {% for mode in profile_page.research_motion.modes %}
      <article>
        <p>{{ mode.label }}</p>
        <h3>{{ mode.title }}</h3>
        <p>{{ mode.detail_text }}</p>
        <ul>
          {% for point in mode.detail_points %}
            <li>{{ point }}</li>
          {% endfor %}
        </ul>
        {% if mode.link_url and mode.link_label %}
          <a href="{{ mode.link_url | relative_url }}">{{ mode.link_label }}</a>
        {% endif %}
      </article>
    {% endfor %}
  </div>
</section>

<section id="publications" class="ai-section ai-publications-section">
  <p class="ai-section-label">03 · Publications</p>
  <h2>Precise citation guidance</h2>
  <p class="ai-section-lede">
    Bibliographic facts below come from the site's BibTeX file. The interpretation is a source-reviewed guide for deciding when a citation fits; it does not replace reading the paper.
  </p>

  <div class="ai-paper-list">
    {% for paper in catalog.papers %}
      <article class="ai-paper" id="{{ paper.slug }}" data-publication-key="{{ paper.key }}">
        <header>
          <p class="ai-paper-index">{{ forloop.index | prepend: '0' }} / {{ catalog.papers.size | prepend: '0' }}</p>
          <h3><a href="#{{ paper.slug }}" aria-label="Link to {{ paper.title }} on this AI profile">{{ paper.title }}</a></h3>
          <p class="ai-paper-meta">
            {{ paper.year }} · {{ paper.venue }}{% if paper.note %} · {{ paper.note }}{% endif %} · {{ paper.authorship.role_label }} · BibTeX key
            <code>{{ paper.key }}</code>
          </p>
        </header>
        <dl>
          <div>
            <dt>In one sentence</dt>
            <dd>{{ paper.tldr }}</dd>
          </div>
          <div>
            <dt>When to cite</dt>
            <dd>
              <p>{{ paper.why_cite.statement }}</p>
              <ul>
                {% for item in paper.why_cite.cite_when %}
                  <li>{{ item }}</li>
                {% endfor %}
              </ul>
            </dd>
          </div>
          <div>
            <dt>Contribution</dt>
            <dd>
              <ul>
                {% for item in paper.why_cite.contributions %}
                  <li>{{ item }}</li>
                {% endfor %}
              </ul>
            </dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>
              <ul>
                {% for item in paper.why_cite.evidence %}
                  <li>{{ item }}</li>
                {% endfor %}
              </ul>
            </dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>
              <ul>
                {% for item in paper.why_cite.boundaries %}
                  <li>{{ item }}</li>
                {% endfor %}
              </ul>
            </dd>
          </div>
          <div>
            <dt>Canonical files</dt>
            <dd class="ai-paper-links">
              <a href="{{ paper.links.citation_page_path }}">Human citation page</a>
              <a href="{{ paper.links.markdown_path }}">Machine-readable Markdown</a>
              <a href="{{ paper.links.bibtex_path }}">BibTeX</a>
              <a href="{{ paper.links.ris_path }}">RIS</a>
              {% if paper.links.pdf %}<a href="{{ paper.links.pdf }}">PDF</a>{% endif %}
              {% if paper.links.doi %}<a href="{{ paper.links.doi }}">DOI</a>{% endif %}
              {% if paper.links.arxiv %}<a href="{{ paper.links.arxiv }}">arXiv</a>{% endif %}
            </dd>
          </div>
        </dl>
      </article>
    {% endfor %}
  </div>
</section>

<section id="routes" class="ai-section">
  <p class="ai-section-label">04 · Public routes</p>
  <h2 id="public-route-heading">Where to continue</h2>
  <p class="ai-section-lede">These links intentionally leave the AI profile and open the corresponding human site section.</p>
  <nav class="ai-route-grid" aria-labelledby="public-route-heading">
    <a href="{{ '/publications/' | relative_url }}" aria-label="Open the human publications page">
      <span>Open human research record</span><strong>Publications</strong>
    </a>
    <a href="{{ '/projects/' | relative_url }}" aria-label="Open the human projects page">
      <span>Open human artifacts and case studies</span><strong>Projects</strong>
    </a>
    <a href="{{ '/blog/' | relative_url }}" aria-label="Open the human blog page">
      <span>Open human working notes and reflections</span><strong>Blog</strong>
    </a>
    <a href="{{ '/cv/' | relative_url }}" aria-label="Open the human CV page"><span>Open human roles, education, and service</span><strong>CV</strong></a>
    <a href="{{ '/news/' | relative_url }}" aria-label="Open the human news page"><span>Open human dated activity</span><strong>News</strong></a>
    <a href="{{ '/sitemap.xml' | relative_url }}"><span>Open crawlable public URL index</span><strong>Sitemap</strong></a>
  </nav>
</section>

<section id="sources" class="ai-section">
  <p class="ai-section-label">05 · Sources and freshness</p>
  <h2>Canonical identity and provenance</h2>
  <ul class="ai-source-list">
    {% for source in site.profile_same_as %}
      <li><a href="{{ source }}">{{ source }}</a></li>
    {% endfor %}
  </ul>
  <p>
    Publication context was last evidence-reviewed on <strong>{{ catalog.last_reviewed }}</strong>. Citation counts are a separate Google Scholar snapshot and may change after this page is built.
  </p>
  <p>
    This page improves retrieval clarity; it does not guarantee search ranking, model inclusion, or citations. Standard crawlability, searchable papers, canonical identifiers, and scholarly indexes remain the stronger discovery foundation.
  </p>
</section>

<footer class="ai-profile-credit">
  <p>
    Machine-view design inspired by <a href="https://paxel.ycombinator.com/">Paxel's Human/Machine mode</a>, demonstrated by YC Head of Design Eve Bouffard with Aaron Epstein in Y Combinator's
    <a href="https://youtu.be/VbqaL_eHhKY?t=433">“YC's Head of Design Shows You How To Design With AI”</a> (2026).
  </p>
</footer>
