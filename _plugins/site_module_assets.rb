# jekyll-terser handles .js but leaves this site's authored ES modules untouched. Keep this local
# customization separate from the starter: whitespace/name minification, with compression disabled
# so numerical expressions and GLSL strings retain their authored operations. Fail the build on a
# parser error rather than serving a missing or partially compiled module.
require "digest"
require "json"
require "terser"

module SiruiSite
  module ModuleAssets
    OPTIONS = {
      module: true,
      compress: false,
      mangle: { properties: false },
      keep_fnames: true,
      keep_classnames: true,
      output: { comments: :copyright }
    }.freeze
    COMPILER_KEY = Digest::SHA256.hexdigest(
      [::Terser::VERSION, JSON.generate(OPTIONS), File.read(__FILE__, encoding: "UTF-8").gsub("\r\n", "\n")].join("\0")
    ).freeze

    def self.compile(source)
      @compiler ||= ::Terser.new(OPTIONS)
      @compiler.compile(source)
    end

    class Asset < Jekyll::StaticFile
      def write(dest)
        source = File.read(path, encoding: "UTF-8")
        key = Digest::SHA256.hexdigest(COMPILER_KEY + "\0" + source.gsub("\r\n", "\n"))
        content = Jekyll::Cache.new("sirui-site-module-assets").getset(key) { ModuleAssets.compile(source) }
        records = @site.instance_variable_get(:@sirui_module_records)
        records[relative_path.delete_prefix("/")] = {
          sourceSha256: Digest::SHA256.hexdigest(source.gsub("\r\n", "\n")),
          outputSha256: Digest::SHA256.hexdigest(content), bytes: content.bytesize
        }
        target = destination(dest)
        return false if File.file?(target) && File.binread(target) == content.b

        FileUtils.mkdir_p(File.dirname(target))
        File.binwrite(target, content)
        true
      rescue StandardError => error
        raise Jekyll::Errors::FatalException, "Site module #{relative_path}: #{error.message}"
      end
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  site.instance_variable_set(:@sirui_module_records, {})
  site.static_files.map! do |file|
    next file unless file.relative_path.match?(%r{\A/assets/js/.+\.mjs\z})

    SiruiSite::ModuleAssets::Asset.new(site, site.source, File.dirname(file.relative_path), File.basename(file.path))
  end
end

# Verification tools can bind the served bytes to the authored module and the
# exact build recipe. This is an artifact receipt; visitors do not fetch it.
Jekyll::Hooks.register :site, :post_write do |site|
  records = site.instance_variable_get(:@sirui_module_records)
  next unless records

  fingerprint = ->(name) { Digest::SHA256.hexdigest(File.read(File.join(site.source, name), encoding: "UTF-8").gsub("\r\n", "\n")) }
  receipt = {
    schema: "sirui-site-module-build-v1",
    pipeline: { pluginSha256: fingerprint.call("_plugins/site_module_assets.rb"), lockSha256: fingerprint.call("Gemfile.lock"),
                compiler: ::Terser::VERSION, compilerKey: SiruiSite::ModuleAssets::COMPILER_KEY },
    modules: records.sort.to_h
  }
  target = File.join(site.dest, "assets/js/module-build.json")
  FileUtils.mkdir_p(File.dirname(target))
  File.binwrite(target, JSON.generate(receipt) + "\n")
end
