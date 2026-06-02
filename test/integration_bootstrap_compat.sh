#!/usr/bin/env bash
set -euo pipefail

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

site="${tmp_dir}/site"
override_file="${tmp_dir}/im-off.yml"

cat >"${override_file}" <<'YAML'
imagemagick:
  enabled: false
YAML

bundle exec jekyll build --config "_config.yml,${override_file}" -d "${site}" >/dev/null

index="${site}/index.html"
grep -q '/assets/css/bootstrap.min.css' "${index}"
grep -q '/assets/js/bootstrap.bundle.min.js' "${index}"
grep -qiE '<script[^>]+src=["'"'"'][^"'"'"']*jquery[^"'"'"']*["'"'"']' "${index}"
ruby -ryaml -e 'cfg = YAML.load_file("_config.yml"); enabled = cfg.dig("al_folio", "compat", "bootstrap", "enabled"); abort("bootstrap compatibility is not enabled in _config.yml") unless enabled == true'

echo "bootstrap compatibility integration checks passed"
