require "bundler/setup"
require "terser"
compiler = ::Terser.new({compress: {drop_console: true}})
File.binwrite(ARGV[1], compiler.compile(File.read(ARGV[0], encoding: "UTF-8")))
