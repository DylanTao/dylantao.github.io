#!/usr/bin/env bash
set -euo pipefail

tmp_dir="$(mktemp -d)"
tmp_override="${tmp_dir}/distill-override.yml"
tmp_site="${tmp_dir}/site"

# The al-folio distill demo post was removed from this site, so the test writes
# its own unpublished fixture and removes it on exit. The 9999-01-01 prefix is
# gitignored so an interrupted run never leaves a committable post behind.
fixture_distill="_posts/9999-01-01-integration-distill.md"

cleanup() {
  rm -f "${fixture_distill}"
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

cat >"${fixture_distill}" <<'MD'
---
layout: distill
title: integration fixture distill post
description: fixture written by test/integration_distill.sh
date: 2021-05-22
permalink: /blog/2021/integration-distill/
giscus_comments: true
featured: false
published: false
mermaid:
  enabled: true
  zoomable: true
tikzjax: true

authors:
  - name: Fixture Author
    url: "https://example.com"
    affiliations:
      name: Integration Test

toc:
  - name: Mermaid
  - name: TikZ
---

## Mermaid

```mermaid
sequenceDiagram
    Test->>Build: request page
    Build-->>Test: rendered fixture
```

## TikZ

<script type="text/tikz">
  \begin{tikzpicture}
    \draw (0,0) circle (1in);
  \end{tikzpicture}
</script>
MD

cat >"${tmp_override}" <<'YAML'
imagemagick:
  enabled: false
giscus:
  repo: alshedivat/al-folio
  repo_id: R_kgDOExample
  category: Comments
  category_id: DIC_kwDOExample
YAML

bundle exec jekyll build --unpublished --config "_config.yml,${tmp_override}" -d "${tmp_site}" >/dev/null

distill_page="${tmp_site}/blog/2021/integration-distill/index.html"

if [ ! -f "${distill_page}" ]; then
  echo "distill page was not generated at ${distill_page}" >&2
  exit 1
fi

grep -q 'd-front-matter' "${distill_page}"
grep -q '/assets/js/distillpub/template.v2.js' "${distill_page}"
grep -q '/assets/js/distillpub/transforms.v2.js' "${distill_page}"
grep -q '/assets/js/distillpub/overrides.js' "${distill_page}"
grep -q '/assets/js/mermaid-setup.js' "${distill_page}"
grep -q '/assets/css/tikzjax.min.css' "${distill_page}"
grep -q '/assets/js/tikzjax.min.js' "${distill_page}"
grep -q 'id="giscus_thread"' "${distill_page}"

echo "distill integration checks passed"
