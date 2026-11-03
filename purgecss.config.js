const { defaultOptions } = require("purgecss");

module.exports = {
  // P, the coastal worlds, and reading enhancements mount their UI from ES modules.
  content: ["_site/**/*.html", "_site/**/*.js", "_site/**/*.mjs"],
  css: ["_site/assets/css/*.css"],
  output: "_site/assets/css/",
  skippedContentGlobs: ["_site/assets/**/*.html"],
  // DOMStringMap creates dashed attributes at runtime. Keep the actual
  // names used by the shipped scripts as well as the processor's usual tokens.
  defaultExtractor(content) {
    const tokens = defaultOptions.defaultExtractor(content);
    for (const match of content.matchAll(/\bdataset\s*(?:\??\.\s*([A-Za-z_$][\w$]*)|\[\s*["']([A-Za-z_$][\w$]*)["']\s*\])/g)) {
      const name = match[1] || match[2];
      tokens.push(`data-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
    }
    return tokens;
  },
  safelist: {
    standard: [
      /^home-/,
      /^research-motion-/,
      /^theme-/,
      /^is-/,
      /^fa-/,
      /^fa[srbl]?$/,
      /^ai-/,
      /^ninja-/,
      /^cinematic-/,
      /^case-/,
      /^sirui-/,
      // Inline/dock suffixes are assembled from a template and a variant.
      /^section-reading-aid-mobile(?:-|$)/,
      "post-header-field",
      "has-spotlight",
      "collapse",
      "collapsing",
      "show",
      "dropdown-menu",
      "dropdown-item",
      "table",
      "table-dark",
      "table-hover",
      "table-responsive",
      "af-tooltip",
      "af-popover",
      "font-weight-bold",
      "font-weight-medium",
      "font-weight-lighter",
      "medium-zoom-overlay",
      "medium-zoom-image--opened",
    ],
    deep: [/^home-/, /^theme-/, /^research-motion-/, /^ninja-/, /^sirui-/],
    greedy: [
      // Discovery state is created through dataset after the built HTML loads.
      // Keep its complete selectors, including the compact and reduced-motion states.
      /data-brand-state/,
      /data-theme/,
      /data-theme-mode/,
      /home-motion/,
      /home-research-motion/,
      /home-story-rail/,
      /home-visible/,
      /research-motion/,
      /theme-menu/,
      /theme-toggle/,
      /is-active/,
      /view-transition/,
    ],
    keyframes: [/^home-/, /^site-/, /^cinematic-/, /^brand-/],
    variables: [
      /^--global-/,
      /^--home-/,
      /^--md-lite-/,
      /^--motion-/,
      /^--research-motion-/,
      /^--measure-/,
      /^--type-/,
      /^--spot-/,
      /^--tilt-/,
      /^--case-/,
    ],
  },
};
