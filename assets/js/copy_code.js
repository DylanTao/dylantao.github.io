// Copy and copied glyphs: Lucide clipboard and clipboard-check (lucide-static 1.49.0, ISC; licence in _data/icons.yml).
const COPY_CODE_ICON =
  '<svg class="site-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>';
const COPIED_CODE_ICON =
  '<svg class="site-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>';

// create element for copy button in code blocks
var codeBlocks = document.querySelectorAll("pre");
codeBlocks.forEach(function (codeBlock) {
  if (
    (codeBlock.querySelector("pre:not(.lineno)") || codeBlock.querySelector("code")) &&
    codeBlock.querySelector("code:not(.language-chartjs)") &&
    codeBlock.querySelector("code:not(.language-diff2html)") &&
    codeBlock.querySelector("code:not(.language-echarts)") &&
    codeBlock.querySelector("code:not(.language-geojson)") &&
    codeBlock.querySelector("code:not(.language-mermaid)") &&
    codeBlock.querySelector("code:not(.language-plotly)") &&
    codeBlock.querySelector("code:not(.language-vega_lite)")
  ) {
    // create copy button
    var copyButton = document.createElement("button");
    copyButton.className = "copy";
    copyButton.type = "button";
    copyButton.ariaLabel = "Copy code to clipboard";
    copyButton.innerHTML = COPY_CODE_ICON;
    const feedback = document.createElement("span");
    feedback.className = "copy-feedback";
    feedback.setAttribute("role", "status");
    let resetTimer;

    // get code from code block and copy to clipboard
    copyButton.addEventListener("click", async function () {
      if (copyButton.disabled) return;
      clearTimeout(resetTimer);
      copyButton.disabled = true;
      // check if code block has line numbers
      // i.e. `kramdown.syntax_highlighter_opts.block.line_numbers` set to true in _config.yml
      // or using `jekyll highlight` liquid tag with `linenos` option
      if (codeBlock.querySelector("pre:not(.lineno)")) {
        // get code from code block ignoring line numbers
        var code = codeBlock.querySelector("pre:not(.lineno)").innerText.trim();
      } else {
        // if (codeBlock.querySelector('code')) {
        // get code from code block when line numbers are not displayed
        var code = codeBlock.querySelector("code").innerText.trim();
      }
      try {
        await window.navigator.clipboard.writeText(code);
        copyButton.innerHTML = COPIED_CODE_ICON;
        copyButton.ariaLabel = "Code copied";
        feedback.textContent = "Copied";
      } catch {
        copyButton.innerHTML = COPY_CODE_ICON;
        copyButton.ariaLabel = "Retry copying code";
        feedback.textContent = "Couldn’t copy. Select the code to copy it manually.";
      } finally {
        copyButton.disabled = false;
        resetTimer = setTimeout(function () {
          copyButton.innerHTML = COPY_CODE_ICON;
          copyButton.ariaLabel = "Copy code to clipboard";
          feedback.textContent = "";
        }, 4000);
      }
    });

    // create wrapper div
    var wrapper = document.createElement("div");
    wrapper.className = "code-display-wrapper";

    // add copy button and code block to wrapper div
    const parent = codeBlock.parentElement;
    parent.insertBefore(wrapper, codeBlock);
    wrapper.append(codeBlock);
    wrapper.append(copyButton);
    wrapper.append(feedback);
  }
});
