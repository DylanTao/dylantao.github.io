(function () {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReducedMotion = () => reduceMotionQuery.matches;

  const copyButtons = Array.from(document.querySelectorAll("[data-spooder-copy-prompt]"));

  const copyPrompt = async (text) => {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // Fall through to the selection-based fallback below.
      }
    }

    const priorFocus = document.activeElement;
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.readOnly = true;
    fallback.style.position = "fixed";
    fallback.style.insetBlockStart = "-9999px";
    fallback.style.inlineSize = "1px";
    fallback.style.blockSize = "1px";
    fallback.style.opacity = "0";
    document.body.append(fallback);
    fallback.focus();
    fallback.select();

    try {
      return document.execCommand("copy");
    } catch (error) {
      return false;
    } finally {
      fallback.remove();
      window.getSelection()?.removeAllRanges();
      if (priorFocus instanceof HTMLElement && priorFocus.isConnected) {
        priorFocus.focus({ preventScroll: true });
      }
    }
  };

  copyButtons.forEach((button) => {
    const promptCard = button.closest("[data-spooder-prompt-card], .hci-spooder-prompt");
    const textarea = promptCard?.querySelector("textarea");
    const defaultLabel = button.textContent;

    button.addEventListener("click", async () => {
      if (!textarea) return;

      const copied = await copyPrompt(textarea.value);
      button.textContent = copied ? "Copied" : "Select text";

      window.setTimeout(() => {
        button.textContent = defaultLabel;
      }, 1600);
    });
  });

  const imageCarousel = document.querySelector("[data-spooder-image-carousel]");

  if (imageCarousel) {
    const stage = imageCarousel.querySelector(".hci-spooder-gallery-stage");
    const slides = Array.from(imageCarousel.querySelectorAll("[data-spooder-image-slide]"));
    const thumbs = Array.from(imageCarousel.querySelectorAll("[data-spooder-image-thumb]"));
    const prevButton = imageCarousel.querySelector("[data-spooder-image-prev]");
    const nextButton = imageCarousel.querySelector("[data-spooder-image-next]");
    let activeImageIndex = 0;

    const scrollThumbIntoView = (thumb) => {
      const scroller = thumb?.parentElement;
      if (!thumb || !scroller) return;

      const left = thumb.offsetLeft - (scroller.clientWidth - thumb.clientWidth) / 2;
      scroller.scrollTo({
        left,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    };

    const setActiveImage = (index, options = {}) => {
      if (!slides.length) return;

      activeImageIndex = (index + slides.length) % slides.length;

      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === activeImageIndex;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", active ? "false" : "true");
      });

      thumbs.forEach((thumb, thumbIndex) => {
        const active = thumbIndex === activeImageIndex;
        thumb.classList.toggle("is-active", active);
        thumb.setAttribute("aria-current", active ? "true" : "false");
      });

      const activeThumb = thumbs[activeImageIndex];
      if (activeThumb && options.scrollThumb) {
        scrollThumbIntoView(activeThumb);
      }

      if (activeThumb && options.focusThumb) {
        activeThumb.focus({ preventScroll: true });
      }
    };

    prevButton?.addEventListener("click", () => setActiveImage(activeImageIndex - 1, { scrollThumb: true }));
    nextButton?.addEventListener("click", () => setActiveImage(activeImageIndex + 1, { scrollThumb: true }));

    thumbs.forEach((thumb, index) => {
      thumb.addEventListener("click", () => setActiveImage(index, { scrollThumb: false }));
    });

    stage?.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();

      if (event.key === "ArrowLeft") {
        setActiveImage(activeImageIndex - 1, { scrollThumb: true });
      } else if (event.key === "ArrowRight") {
        setActiveImage(activeImageIndex + 1, { scrollThumb: true });
      } else if (event.key === "Home") {
        setActiveImage(0, { scrollThumb: true });
      } else {
        setActiveImage(slides.length - 1, { scrollThumb: true });
      }
    });

    imageCarousel.addEventListener("keydown", (event) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-spooder-image-thumb]")) return;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();

      if (event.key === "ArrowLeft") {
        setActiveImage(activeImageIndex - 1, { focusThumb: true, scrollThumb: true });
      } else if (event.key === "ArrowRight") {
        setActiveImage(activeImageIndex + 1, { focusThumb: true, scrollThumb: true });
      } else if (event.key === "Home") {
        setActiveImage(0, { focusThumb: true, scrollThumb: true });
      } else {
        setActiveImage(slides.length - 1, { focusThumb: true, scrollThumb: true });
      }
    });

    setActiveImage(0, { scrollThumb: false });
  }

  const carousel = document.querySelector("[data-spooder-carousel]");

  if (carousel) {
    const track = carousel.querySelector("[data-spooder-track]");
    const slides = Array.from(carousel.querySelectorAll("[data-spooder-slide]"));
    const prevButton = carousel.querySelector("[data-spooder-prev]");
    const nextButton = carousel.querySelector("[data-spooder-next]");
    let activeIndex = 0;

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

      slide.classList.add("is-loaded");
      frame.replaceChildren(iframe);
    };

    const scrollSlideIntoTrack = (slide) => {
      if (!track || !slide) return;

      const left = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
      track.scrollTo({
        left,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    };

    const setActiveSlide = (index, options = { scroll: true }) => {
      if (!slides.length) return;

      activeIndex = (index + slides.length) % slides.length;

      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === activeIndex;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-current", active ? "true" : "false");
        slide.tabIndex = active ? 0 : -1;
      });

      if (options.scroll) {
        scrollSlideIntoTrack(slides[activeIndex]);
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
  }
})();
