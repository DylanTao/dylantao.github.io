require "minitest/autorun"
require "jekyll"
require "base64"
require "open3"
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

  def test_parse_failure_is_not_silently_returned_as_an_empty_asset
    assert_raises(::Terser::Error) { SiruiSite::ModuleAssets.compile("export function {") }
  end
end
