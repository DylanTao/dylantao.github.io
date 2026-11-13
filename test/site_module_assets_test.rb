require "minitest/autorun"
require "jekyll"
require "base64"
require "open3"
require "zlib"
require_relative "../_plugins/site_module_assets"

class SiteModuleAssetsTest < Minitest::Test
  def test_module_exports_and_numeric_operations_survive
    source = <<~JS
      /*! Copyright 2026 Sirui Tao, MIT */
      const lengthyPrivateBinding = 2;
      export const calculate = (a, b) => (a * lengthyPrivateBinding) * b;
      export const shader = `uniform vec3 slfRegionMin[10];\nvoid main(){gl_FragColor=vec4(1.0);}`;
      export function namedFunction() { return "Sirui’s Pacific"; }
    JS
    output = SiruiSite::ModuleAssets.compile(source)
    assert_includes output, "Copyright 2026 Sirui Tao, MIT"
    assert_match(/export const calculate=/, output)
    assert_includes output, "uniform vec3 slfRegionMin[10]"
    assert_includes output, "function namedFunction()"
    refute_includes output, "lengthyPrivateBinding"
    original_url = "data:text/javascript;base64,#{Base64.strict_encode64(source)}"
    compiled_url = "data:text/javascript;base64,#{Base64.strict_encode64(output)}"
    script = <<~JS
      const a = await import(#{JSON.generate(original_url)}), b = await import(#{JSON.generate(compiled_url)});
      for (const [x,y] of [[1e308,1e-308],[1e-308,1e308],[-0,2],[NaN,3]]) {
        if (!Object.is(a.calculate(x,y), b.calculate(x,y))) throw new Error('floating point operation changed');
      }
      if (a.shader !== b.shader || a.namedFunction() !== b.namedFunction() || b.namedFunction.name !== 'namedFunction')
        throw new Error('module strings or function identity changed');
    JS
    _, stderr, status = Open3.capture3("node", "--input-type=module", "-e", script)
    assert status.success?, stderr
  end

  # test_coastal_assets.py subtracts this credit from the source bytes it counts toward the 4 MiB
  # first-scene transfer. Compile every scene module with the build's own compiler so the credit
  # can never exceed what Pages actually saves.
  def test_compiled_scene_modules_save_at_least_the_first_scene_credit
    credit = JSON.parse(File.read(File.expand_path("fixtures/first-scene-transfer.json", __dir__)))["compiledSceneModuleCreditBytes"]
    transfer = ->(bytes) { Zlib.gzip(bytes, level: 6).bytesize }
    paths = Dir[File.expand_path("../assets/js/home-scene/*.mjs", __dir__)]
    refute_empty paths
    source = compiled = 0
    paths.each do |path|
      raw = File.binread(path)
      source += transfer.call(raw)
      compiled += transfer.call(SiruiSite::ModuleAssets.compile(raw.force_encoding("UTF-8").gsub("\r\n", "\n")).b)
    end
    assert_operator source - compiled, :>=, credit, "compiled scene modules save #{source - compiled} gzip bytes; the budget credits #{credit}"
  end

  def test_parse_failure_is_not_silently_returned_as_an_empty_asset
    assert_raises(::Terser::Error) { SiruiSite::ModuleAssets.compile("export function {") }
  end
end
