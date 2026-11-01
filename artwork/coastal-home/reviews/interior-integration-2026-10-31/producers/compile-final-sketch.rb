# Incremental iteration uses the exact owning Jekyll module compiler and receipt.
# The complete production build is retained beside this small final report fix.
require "jekyll"
require_relative "../../../_plugins/site_module_assets"
require "fileutils"
root = Dir.pwd
dest = File.join(__dir__, "site/al-folio")
receipt_path = File.join(dest, "assets/js/module-build.json")
receipt = JSON.parse(File.read(receipt_path))
%w[controller loading-sketch loading-sketch-worker].each do |name|
  relative = "assets/js/home-scene/#{name}.mjs"
  source = File.read(File.join(root, relative), encoding: "UTF-8")
  compiled = SiruiSite::ModuleAssets.compile(source)
  File.binwrite(File.join(dest, relative), compiled)
  receipt["modules"][relative] = {
    "sourceSha256" => Digest::SHA256.hexdigest(source.gsub("\r\n", "\n")),
    "outputSha256" => Digest::SHA256.hexdigest(compiled), "bytes" => compiled.bytesize
  }
end
File.binwrite(receipt_path, JSON.generate(receipt) + "\n")
puts "Final reporting fix compiled by the unmodified Jekyll/Terser producer"
