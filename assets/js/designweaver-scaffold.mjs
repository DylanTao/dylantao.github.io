// DesignWeaver's dimensional scaffold, small enough to try on the case page. Tags grouped by design
// dimension build a prompt. The page starts from a real session's selection and the prompt
// DesignWeaver wrote for it; any change rebuilds the prompt with a fixed sentence (the system
// itself uses a language model). Nothing is sent anywhere and no image is generated.
const root = document.querySelector("[data-dw-scaffold]");

if (root) {
  const tags = [...root.querySelectorAll("[data-dw-tag]")];
  const output = root.querySelector("[data-dw-prompt]");
  const label = root.querySelector("[data-dw-prompt-label]");
  const count = root.querySelector("[data-dw-count]");
  const reset = root.querySelector("[data-dw-reset]");
  const sessionPrompt = output.textContent.trim();
  const sessionSelection = tags.map((tag) => tag.getAttribute("aria-pressed") === "true");
  const dimensions = new Set(tags.map((tag) => tag.dataset.dimension)).size;

  const list = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);
  const phrase = (tag) => {
    const span = document.createElement("span");
    span.className = "dw-scaffold__phrase";
    span.dataset.dimension = tag.dataset.dimension;
    span.textContent = tag.dataset.phrase;
    return span;
  };

  // "A neutral, durable, ergonomic chair with clean lines in soft lavender."
  function sentence(selected) {
    const of = (form) => selected.filter((tag) => tag.dataset.form === form);
    const before = of("before"),
      withs = of("with"),
      colors = of("in");
    const parts = [];
    const head = [...before.map((tag) => tag.dataset.phrase), "chair"].join(" ");
    parts.push(/^[aeiou]/i.test(head) ? "An " : "A ");
    before.forEach((tag, index) => {
      parts.push(phrase(tag), index < before.length - 1 ? ", " : " ");
    });
    parts.push("chair");
    const join = (items) =>
      items.forEach((tag, index) => {
        if (index) parts.push(index === items.length - 1 ? " and " : ", ");
        parts.push(phrase(tag));
      });
    if (withs.length) {
      parts.push(" with ");
      join(withs);
    }
    if (colors.length) {
      parts.push(" in ");
      join(colors);
    }
    parts.push(".");
    return parts;
  }

  // Tags and dimensions, not words: the fixed sentence is terser than the model's prose, so a word
  // count would drop on the first click and contradict the point.
  function describe(selected) {
    const used = new Set(selected.map((tag) => tag.dataset.dimension)).size;
    const tagWord = selected.length === 1 ? "tag" : "tags";
    count.textContent = `${selected.length} ${tagWord} across ${used} of ${dimensions} dimensions`;
  }

  function render(fromSession = false) {
    const selected = tags.filter((tag) => tag.getAttribute("aria-pressed") === "true");
    if (fromSession) {
      output.textContent = sessionPrompt;
      label.textContent = "DesignWeaver’s prompt for this selection";
    } else {
      output.replaceChildren(...sentence(selected));
      label.textContent = "Your prompt, as a fixed sentence";
    }
    reset.hidden = fromSession;
    describe(selected);
  }

  tags.forEach((tag) => {
    tag.disabled = false;
    tag.addEventListener("click", () => {
      tag.setAttribute("aria-pressed", String(tag.getAttribute("aria-pressed") !== "true"));
      render();
    });
  });
  reset.addEventListener("click", () => {
    tags.forEach((tag, index) => tag.setAttribute("aria-pressed", String(sessionSelection[index])));
    render(true);
    tags[0].focus();
  });
  root.dataset.dwScaffoldReady = "";
  render(true);
}
