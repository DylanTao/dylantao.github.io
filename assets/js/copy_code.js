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
    copyButton.innerHTML = '<i class="fa-solid fa-clipboard" aria-hidden="true"></i>';
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
        copyButton.innerHTML = '<i class="fa-solid fa-clipboard-check" aria-hidden="true"></i>';
        copyButton.ariaLabel = "Code copied";
        feedback.textContent = "Copied";
      } catch {
        copyButton.innerHTML = '<i class="fa-solid fa-clipboard" aria-hidden="true"></i>';
        copyButton.ariaLabel = "Retry copying code";
        feedback.textContent = "Couldn’t copy. Select the code to copy it manually.";
      } finally {
        copyButton.disabled = false;
        resetTimer = setTimeout(function () {
          copyButton.innerHTML = '<i class="fa-solid fa-clipboard" aria-hidden="true"></i>';
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
