#!/usr/bin/env bash
set -euo pipefail

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

remove_plugin_and_build() {
  local plugin="$1"
  local override="${tmp_dir}/${plugin}-override.yml"
  local output_site="${tmp_dir}/site-${plugin}"

  echo "checking build without ${plugin}"
  ruby -rpsych -e '
    plugin = ARGV.fetch(0)
    cfg = Psych.unsafe_load_file("_config.yml")
    plugins = Array(cfg["plugins"]).reject { |entry| entry == plugin }
    override = {
      "plugins" => plugins,
      "imagemagick" => { "enabled" => false },
    }

    case plugin
    when "al_analytics"
      override["enable_google_analytics"] = false
      override["google_analytics"] = nil
      override["analytics"] = { "google" => nil }
    when "al_search"
      override["search_enabled"] = false
      override["socials_in_search"] = false
      override["posts_in_search"] = false
      override["bib_search"] = false
    end

    puts override.to_yaml
  ' "${plugin}" >"${override}"

  bundle exec jekyll build --config "_config.yml,${override}" -d "${output_site}" >/dev/null
  if [ ! -f "${output_site}/index.html" ]; then
    echo "expected site output for plugin toggle ${plugin}" >&2
    exit 1
  fi
}

remove_plugin_and_build "al_analytics"
remove_plugin_and_build "al_img_tools"
remove_plugin_and_build "al_search"

echo "plugin toggle integration checks passed"
