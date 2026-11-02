# Pinned Ruby runner compatibility

The entrance checkpoint `8aa13ce08` passes its local build and tests, but all 42 visual CI jobs fail in Ruby setup before application checks. Deployment, integration and upgrade checks encounter the same missing Ruby 3.3.5 archive on an Ubuntu 26.04 runner. The original failed logs and complete visual-job snapshot remain here.

All seven workflows using a pinned Ruby patch now select Ubuntu 24.04 explicitly. Their Ruby versions, steps, permissions, assertions and visual matrix remain unchanged. Semantic YAML comparisons verify that scope, and both official Ruby 3.3.5 and 3.2.2 release downloads return HTTP 200 for Ubuntu 24.04. The action documents that newer runner images may provide only the latest Ruby patch and recommends an explicit runner when retaining an older patch. [ruby/setup-ruby supported platforms](https://github.com/ruby/setup-ruby#supported-platforms), [GitHub runner images](https://github.com/actions/runner-images#available-images).

This fixes runner selection only. Application, native geometry, shaders, cache and data bytes remain those of the entrance checkpoint. The corrected remote runs and live deployment require their own subsequent receipt; failed setup jobs are not counted as application passes.
