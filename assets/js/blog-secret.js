(() => {
  const trigger = document.getElementById("sirui-secret-dog");
  const dialog = document.getElementById("sirui-secret-dialog");
  const closeButton = document.getElementById("sirui-secret-close");
  const form = document.getElementById("sirui-secret-form");
  const password = document.getElementById("sirui-secret-password");

  if (!trigger || !dialog || !closeButton || !form || !password) return;

  const secretUrl = trigger.dataset.secretUrl;
  const animationClasses = ["is-curious", "is-curious", "is-suspicious", "is-wiggle", "is-victory-roll", "is-glitch-secret"];
  const animationClassSet = new Set(animationClasses);
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeAnimation = "";
  let resetTimer;

  const clearAnimation = () => {
    animationClassSet.forEach((className) => trigger.classList.remove(className));
    activeAnimation = "";
  };

  const startHoverAnimation = () => {
    window.clearTimeout(resetTimer);

    if (!finePointer.matches || reducedMotion.matches || activeAnimation) return;

    activeAnimation = animationClasses[Math.floor(Math.random() * animationClasses.length)];
    trigger.classList.add(activeAnimation);
  };

  const stopHoverAnimation = () => {
    if (!activeAnimation) return;

    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(clearAnimation, 140);
  };

  const pulseTrigger = () => {
    if (reducedMotion.matches) return;

    window.clearTimeout(resetTimer);
    trigger.classList.remove("is-booping");
    void trigger.offsetWidth;
    trigger.classList.add("is-booping");
    window.setTimeout(() => trigger.classList.remove("is-booping"), 820);
  };

  const openDialog = () => {
    pulseTrigger();
    dialog.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    password.value = "";
    if (window.matchMedia("(pointer: fine)").matches) {
      window.setTimeout(() => password.focus(), 0);
    }
  };

  const closeDialog = () => {
    dialog.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus({ preventScroll: true });
  };

  trigger.addEventListener("pointerenter", startHoverAnimation);
  trigger.addEventListener("pointerleave", stopHoverAnimation);
  trigger.addEventListener("focus", startHoverAnimation);
  trigger.addEventListener("blur", stopHoverAnimation);
  trigger.addEventListener("click", openDialog);
  closeButton.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) closeDialog();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sessionStorage.setItem("siruiResearchThoughtsPassword", password.value.trim());
    window.location.href = secretUrl;
  });
})();
