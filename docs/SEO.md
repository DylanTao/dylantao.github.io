# Search and AI discovery

This customized site presents Sirui Tao's research, projects, writing, and CV. Discovery work should make that existing record easier to find, read, and cite while preserving its voice and scope.

Google's [AI search guidance](https://developers.google.com/search/docs/appearance/ai-features) uses the same foundations as ordinary search: indexable pages, useful visible content, internal links, and structured data that agrees with the page. Eligibility does not guarantee inclusion or ranking. Extra AI text files or a special AI schema are not required.

## What this site publishes

- Human pages contain the full first-person story, research evidence, credit, and ordinary links.
- `/ai/` provides a compact server-rendered index with stable project and publication anchors, writing, and current CV links.
- `/ai/publications.json`, `/ai/projects.json`, paper Markdown/BibTeX/RIS, and `llms.txt`/`llms-full.txt` are retrieval formats. They project from canonical sources and do not promise recommendations.
- `_bibliography/papers.bib` owns bibliographic facts. `_data/publication_context.yml` owns source-reviewed citation guidance; `_data/publication_lens.yml` supplies display classifications and authorship checks.
- `_data/resume.json` and its identical public copy, `assets/json/resume.json`, provide the current structured CV. The four-page tagged PDF is generated from the same public record, with its source and output bound by `artwork/cv/build-receipt.json`. The web CV, JSON Resume, PDF, and web print view carry the current facts; the [print source](../artwork/cv/README.md) preserves the established typography and rejection notes without older citation statistics.

The site's `Person` identifier is shared by the homepage profile, CV, and authored work. Genuine posts use `BlogPosting`; projects use `CreativeWork` with their actual category. Archives, indexes, and process-record pages must not masquerade as authored posts or papers. Unknown dates stay absent rather than becoming January 1.

## Configuration and ownership

Intentional local metadata lives in `_includes/metadata.liquid` and `_includes/head.liquid`. This is a customized fork; see [ownership boundaries](BOUNDARIES.md) before replacing a local override with theme defaults.

```yaml
url: https://dylantao.github.io
baseurl: ""
serve_og_meta: true
serve_schema_org: true
enable_google_verification: true
google_site_verification: YOUR_EXISTING_PUBLIC_VERIFICATION_CODE
```

Use the actual deployed URL from `_config.yml`; the block above illustrates the configuration shape. The verification flag and a legitimate token are both required. Emitting a token does not prove that the account has verified ownership or submitted its sitemap. Never invent verification values. Bing has a separate flag/token and remains optional.

Use `seo_title` and `seo_description` when a concise search summary should differ from visible page copy. Keep both faithful to the same work. A meaningful title or description matters more than an arbitrary character count; search engines may choose a different snippet.

`robots.txt` currently allows crawling, including search crawlers. OpenAI documents [OAI-SearchBot separately from GPTBot](https://developers.openai.com/api/docs/bots): search access and training preferences are distinct decisions. Do not change training policy as a side effect of search optimization.

## Make a change and inspect the result

1. Identify the visitor's task and the canonical evidence: find a paper, understand a contribution, inspect the CV, or contact Sirui.
2. Inspect the rendered route and its current links before editing. Preserve wording that already works; correct missing context, dates, status, or access where the evidence calls for it.
3. Check one canonical URL, useful title/description, social preview, and accurate JSON-LD. Follow every changed Human/AI or raw-format link, including its fragment, with JavaScript disabled where relevant.
4. Inspect semantic headings, duplicate IDs, descriptive link names, keyboard focus, mobile overflow, and document print behavior. Alt text explains an image's role; it is not a keyword list.
5. Build and run the generated-output validator, plus affected content/style and visual checks from [AGENTS.md](../AGENTS.md).

```powershell
bundle exec jekyll build --baseurl /al-folio
python test/validate_publication_outputs.py _site
```

For production, also verify the empty-baseurl deployment and live artifacts against the released source revision. The validator checks publication facts and consistency among generated discovery surfaces; it does not establish indexing, accessibility conformance, or ranking by itself.

The sitemap should list intentional public routes. Assets are excluded by this site's sitemap defaults; starter example CV output is also excluded from deployment. Do not make hidden/demo content public merely to increase page count. Keep scholarly landing pages, stable identifiers, and linked searchable PDFs available; Scholar inclusion is governed by [its publisher guidelines](https://scholar.google.com/intl/en/scholar/inclusion.html), not by a promised indexing timeline.

## Measure outcomes

**October 24 status:** [read-only GA4 reporting](ga4-readonly-analysis.md) is working, with the baseline and executed analysis retained privately. Search Console query/indexing evidence remains unverified. Reporting access does not change collection or authorize new tracking.

When authenticated Search Console or analytics data is available, retain a baseline and compare like periods. Record the date range, source, relevant pages/queries, and any changes to measurement. Separate:

- **Availability:** pages fetch successfully, crawl access, canonical/sitemap coverage, valid links and formats.
- **Search visibility:** indexed pages and query impressions, clicks, and click-through rate for Sirui's name, papers, and relevant research questions. Google's AI-feature traffic is included in Search Console's Web reporting; it is not a separate guaranteed recommendation counter.
- **Useful visits:** relevant referrals, readers reaching a paper or CV, and meaningful research/student/collaboration inquiries. A private reader message may suggest what is useful, but is not a public testimonial or a traffic estimate.

Avoid interpreting a short before/after window as causality. Search systems change and recrawling takes time. Page-load timing and scroll milestones describe browser behavior, not whether someone understood the work. Consent and existing collection boundaries still apply.

Before interpretation, retain the report's grain, filters, timezone and canonical denominator, and match its window to the event implementation deployed then. A changed event definition starts a new series; do not compare old repeated scroll counts with once-only milestones. Distinct session/user rows need not add to the undimensioned total. Separate source/device and landing/device breakdowns cannot establish a source-to-landing relationship. Keep detailed findings and sparse audience slices in the private report, not a public handoff.

Without authenticated reporting, record that measurement is unavailable and finish the technical improvements that can be verified. Do not substitute invented rankings or add repetitive keyword pages, hidden instructions, fabricated endorsements, or unsupported claims. Google's [people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) and [guidance on generated content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) support useful, accurate material with a clear human purpose.

Use [Reflective Practice](../WEBSITE_DESIGN_HEURISTICS.md#reflective-practice) to connect the observation, design decision, outcome, uncertainty, and next action. Keep detailed release evidence in its dated evidence record and promote only reusable lessons into the existing skills.
