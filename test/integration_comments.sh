#!/usr/bin/env bash
set -euo pipefail

tmp_dir="$(mktemp -d)"
tmp_override="${tmp_dir}/comments-test-override.yml"
tmp_site="${tmp_dir}/site"

# The al-folio demo posts that carried these checks were removed from this site,
# so the test writes its own unpublished fixture posts and removes them on exit.
# The 9999-01-01 prefix is gitignored so an interrupted run never leaves a
# committable post behind.
fixture_giscus="_posts/9999-01-01-integration-giscus-comments.md"
fixture_disqus="_posts/9999-01-01-integration-disqus-comments.md"

cleanup() {
  rm -f "${fixture_giscus}" "${fixture_disqus}"
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

cat >"${fixture_giscus}" <<'MD'
---
layout: post
title: integration fixture with giscus comments
date: 2022-12-10 11:59:00-0400
description: fixture written by test/integration_comments.sh
permalink: /blog/2022/integration-giscus-comments/
giscus_comments: true
related_posts: false
published: false
---

Fixture post; it exists only while test/integration_comments.sh runs.
MD

cat >"${fixture_disqus}" <<'MD'
---
layout: post
title: integration fixture with disqus comments
date: 2015-10-20 11:59:00-0400
description: fixture written by test/integration_comments.sh
permalink: /blog/2015/integration-disqus-comments/
disqus_comments: true
related_posts: false
published: false
---

Fixture post; it exists only while test/integration_comments.sh runs.
MD

cat >"${tmp_override}" <<'YAML'
imagemagick:
  enabled: false
disqus_shortname: al-folio
giscus:
  repo: alshedivat/al-folio
  repo_id: R_kgDOExample
  category: Comments
  category_id: DIC_kwDOExample
YAML

bundle exec jekyll build --unpublished --config "_config.yml,${tmp_override}" -d "${tmp_site}" >/dev/null

giscus_page="${tmp_site}/blog/2022/integration-giscus-comments/index.html"
disqus_page="${tmp_site}/blog/2015/integration-disqus-comments/index.html"

for page in "${giscus_page}" "${disqus_page}"; do
  if [ ! -f "${page}" ]; then
    echo "fixture page was not generated at ${page}" >&2
    exit 1
  fi
done

grep -q '/assets/js/giscus-setup.js' "${giscus_page}"
if grep -q 'giscus comments misconfigured' "${giscus_page}"; then
  echo "unexpected giscus misconfiguration warning in ${giscus_page}" >&2
  exit 1
fi

grep -q 'id="disqus_thread"' "${disqus_page}"
grep -q '.disqus.com/embed.js' "${disqus_page}"

echo "comments integration checks passed"
