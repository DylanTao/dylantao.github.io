# frozen_string_literal: true

require "digest"

# Keep site-owned templates buildable when the optional al_img_tools plugin is
# disabled. The integration plugin-toggle test removes al_img_tools on purpose,
# but several local includes still use the cache-busting filter for static assets.
module SiruiBustFileCacheFallback
  def bust_file_cache(input)
    return input if input.nil? || input.to_s.empty?

    path = input.to_s
    version = cache_bust_version_for(path)
    separator = path.include?("?") ? "&" : "?"

    "#{path}#{separator}v=#{version}"
  rescue StandardError
    input
  end

  private

  def cache_bust_version_for(path)
    site = @context.registers[:site]
    source_path = source_path_for(site, path)

    if source_path && File.file?(source_path)
      Digest::MD5.file(source_path).hexdigest[0, 10]
    else
      site.time.to_i.to_s
    end
  end

  def source_path_for(site, path)
    path_without_query = path.split("?", 2).first
    relative_path = path_without_query.sub(%r{\A/}, "")
    baseurl = site.config.fetch("baseurl", "").to_s.sub(%r{\A/}, "")

    if !baseurl.empty? && relative_path.start_with?("#{baseurl}/")
      relative_path = relative_path.delete_prefix("#{baseurl}/")
    end

    site.in_source_dir(relative_path)
  end
end

Liquid::Template.register_filter(SiruiBustFileCacheFallback)
