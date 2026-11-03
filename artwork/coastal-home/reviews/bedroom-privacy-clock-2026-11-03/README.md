# Bedroom privacy test clock

The first privacy commit, `1e7adb981`, failed the existing weather guard because its new browser test used the current forecast date. The correction changes that single clock literal to the suite's historical October 23 date. Every assertion and the weather fixture remain unchanged.

The four public viewport checks and the complete JavaScript suite now pass: 1,075 passed, seven existing skips. The product, compiled modules, cache, models and processed CSS are unchanged. Original failures and raw corrected checks are retained here. CI and deployed verification remain separate.

The first corrected-run producer stopped at preflight because it checked the standard HTTP Server header instead of the dedicated preview marker. Its failure is retained; the replacement checks the exact dedicated marker before launching Chromium.
