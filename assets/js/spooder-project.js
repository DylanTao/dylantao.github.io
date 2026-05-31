(function () {
  const copyButtons = Array.from(document.querySelectorAll("[data-spooder-copy-prompt]"));

  const copyPrompt = async (textarea) => {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(textarea.value);
        return true;
      } catch (error) {
        // Fall through to the selection-based fallback below.
      }
    }

    textarea.focus();
    textarea.select();

    try {
      return document.execCommand("copy");
    } catch (error) {
      return false;
    }
  };

  copyButtons.forEach((button) => {
    const promptCard = button.closest(".hci-spooder-prompt");
    const textarea = promptCard?.querySelector("textarea");
    const defaultLabel = button.textContent;

    button.addEventListener("click", async () => {
      if (!textarea) return;

      const copied = await copyPrompt(textarea);
      button.textContent = copied ? "Copied" : "Select text";

      window.setTimeout(() => {
        button.textContent = defaultLabel;
      }, 1600);
    });
  });

  const carousel = document.querySelector("[data-spooder-carousel]");
  if (!carousel) return;

  const track = carousel.querySelector("[data-spooder-track]");
  const slides = Array.from(carousel.querySelectorAll("[data-spooder-slide]"));
  const prevButton = carousel.querySelector("[data-spooder-prev]");
  const nextButton = carousel.querySelector("[data-spooder-next]");
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeIndex = 0;

  const prefersReducedMotion = () => reduceMotionQuery.matches;

  const videoSrc = (id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&vq=hd2160`;

  const loadSlide = (slide) => {
    const frame = slide.querySelector("[data-spooder-video-frame]");
    const videoId = slide.dataset.spooderVideoId;
    if (!frame || !videoId || frame.querySelector("iframe")) return;

    const iframe = document.createElement("iframe");
    iframe.src = videoSrc(videoId);
    iframe.title = slide.querySelector("h3")?.textContent || "Spooder-Man video";
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;

    frame.replaceChildren(iframe);
  };

  const setActiveSlide = (index, options = { scroll: true }) => {
    activeIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-current", active ? "true" : "false");
      slide.tabIndex = active ? 0 : -1;
    });

    if (options.scroll) {
      slides[activeIndex].scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  };

  slides.forEach((slide, index) => {
    slide.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) return;
      setActiveSlide(index);
    });

    slide.querySelector("[data-spooder-load-video]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      setActiveSlide(index);
      loadSlide(slide);
    });
  });

  prevButton?.addEventListener("click", () => setActiveSlide(activeIndex - 1));
  nextButton?.addEventListener("click", () => setActiveSlide(activeIndex + 1));

  track?.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    if (event.key === "ArrowLeft") {
      setActiveSlide(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      setActiveSlide(activeIndex + 1);
    } else if (event.key === "Home") {
      setActiveSlide(0);
    } else {
      setActiveSlide(slides.length - 1);
    }
  });

  if (slides.length > 0) {
    setActiveSlide(0, { scroll: false });
  }
})();
