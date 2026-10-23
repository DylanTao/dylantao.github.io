/**
 * SEO Optimization Script for Academic Website
 * Measures navigation load time and reading progress alongside existing helpers.
 */

(function () {
  "use strict";

  // Load time is milliseconds; engagement is elapsed seconds at unload; depth is a percentage.
  const seoMetrics = {
    pageLoadTime: 0,
    userEngagement: 0,
    scrollDepth: 0,
  };
  let initialized = false;

  // Performance Monitoring
  function monitorPerformance() {
    if (typeof window.performance?.getEntriesByType !== "function") return;

    function measureCompletedLoad() {
      // loadEventEnd is only final after every load handler has returned.
      window.setTimeout(function () {
        const perfData = window.performance.getEntriesByType("navigation")[0];
        if (!perfData || !Number.isFinite(perfData.startTime) || !Number.isFinite(perfData.loadEventEnd)) return;
        if (perfData.startTime < 0 || perfData.loadEventEnd <= perfData.startTime) return;
        seoMetrics.pageLoadTime = perfData.loadEventEnd - perfData.startTime;

        // Send performance data to analytics
        if (typeof gtag !== "undefined") {
          gtag("event", "timing_complete", {
            name: "page_load",
            value: Math.round(seoMetrics.pageLoadTime),
          });
        }
      }, 0);
    }

    if (document.readyState === "complete") {
      measureCompletedLoad();
    } else {
      window.addEventListener("load", measureCompletedLoad, { once: true });
    }
  }

  // Lazy Loading for Images
  function initLazyLoading() {
    if ("IntersectionObserver" in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove("lazy");
            imageObserver.unobserve(img);
          }
        });
      });

      document.querySelectorAll("img[data-src]").forEach((img) => {
        imageObserver.observe(img);
      });
    }
  }

  // Enhanced Meta Tags
  function enhanceMetaTags() {
    // Metadata and JSON-LD are rendered server-side in _includes/metadata.liquid.
    // Keeping this function as a no-op avoids duplicate client-side schema.
  }

  // User Engagement Tracking
  function trackUserEngagement() {
    const reportedMilestones = new Set();

    window.addEventListener("scroll", function () {
      const scrollTop = window.pageYOffset ?? document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (!Number.isFinite(scrollTop) || !Number.isFinite(docHeight) || docHeight <= 0) return;
      const scrollPercent = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
      seoMetrics.scrollDepth = Math.max(seoMetrics.scrollDepth, scrollPercent);

      // A large jump can cross several thresholds. Report each only once per page.
      for (const milestone of [25, 50, 75, 100]) {
        if (scrollPercent < milestone || reportedMilestones.has(milestone)) continue;
        reportedMilestones.add(milestone);
        trackScrollMilestone(milestone);
      }
    });

    // Track time on page
    const startTime = Date.now();
    window.addEventListener("beforeunload", function () {
      const timeOnPage = Math.max(0, Math.round((Date.now() - startTime) / 1000));
      seoMetrics.userEngagement = timeOnPage;
      if (typeof gtag !== "undefined") {
        gtag("event", "timing_complete", {
          name: "time_on_page",
          value: timeOnPage,
        });
      }
    });
  }

  // Track Scroll Milestones
  function trackScrollMilestone(milestone) {
    if (typeof gtag !== "undefined") {
      gtag("event", "scroll_depth", {
        event_category: "engagement",
        event_label: `${milestone}%`,
        value: milestone,
      });
    }
  }

  // Enhanced Search Functionality
  function enhanceSearch() {
    const searchInput = document.querySelector("#search-input");
    if (searchInput) {
      // Add search suggestions
      searchInput.addEventListener("input", function (e) {
        const query = e.target.value;
        if (query.length > 2) {
          showSearchSuggestions(query);
        }
      });

      // Track search queries
      searchInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          trackSearchQuery(e.target.value);
        }
      });
    }
  }

  // Show Search Suggestions
  function showSearchSuggestions(query) {
    // Implementation for search suggestions
    // This could integrate with your existing search functionality
  }

  // Track Search Queries
  function trackSearchQuery(query) {
    if (typeof gtag !== "undefined") {
      gtag("event", "search", {
        search_term: query,
      });
    }
  }

  // Social Media Enhancement - Removed automatic sharing buttons
  function enhanceSocialMedia() {
    // Functionality removed - you already have social section at bottom
  }

  // Initialize SEO Features
  function initSEO() {
    if (initialized) return;
    initialized = true;
    monitorPerformance();
    initLazyLoading();
    enhanceMetaTags();
    trackUserEngagement();
    enhanceSearch();
    enhanceSocialMedia();
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSEO);
  } else {
    initSEO();
  }

  // Export for global access
  window.seoOptimization = {
    metrics: seoMetrics,
    init: initSEO,
  };
})();
