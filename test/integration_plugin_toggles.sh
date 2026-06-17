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
    end

    puts override.to_yaml
  ' "${plugin}" >"${override}"

  bundle exec jekyll build --config "_config.yml,${override}" -d "${output_site}" >/dev/null
  if [ ! -f "${output_site}/index.html" ]; then
    echo "expected site output for plugin toggle ${plugin}" >&2
    exit 1
  fi
}

plugins=("$@")
if [ "${#plugins[@]}" -eq 0 ]; then
  # al_search registers a custom Liquid tag that local templates parse at build
  # time, so this fork treats search as a configured feature rather than a
  # removable plugin. The removable-plugin contract covers plugins whose local
  # integrations are guarded by regular includes/config flags.
  plugins=("al_analytics" "al_img_tools")
fi

for plugin in "${plugins[@]}"; do
  remove_plugin_and_build "${plugin}"
done

echo "plugin toggle integration checks passed"
