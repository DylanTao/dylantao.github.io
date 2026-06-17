# frozen_string_literal: true

# Keep local templates parseable when the optional al_search plugin is disabled.
# Liquid validates custom tags while parsing templates, before it evaluates the
# surrounding `{% if site.plugins contains 'al_search' %}` guard. Without this
# no-op fallback, plugin-toggle builds fail on the unknown `al_search_assets` tag
# even when search UI output is disabled.
unless Liquid::Template.respond_to?(:tags) && Liquid::Template.tags.key?("al_search_assets")
  class AlSearchAssetsFallbackTag < Liquid::Tag
    def render(_context)
      ""
    end
  end

  Liquid::Template.register_tag("al_search_assets", AlSearchAssetsFallbackTag)
end
