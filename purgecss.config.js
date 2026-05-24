module.exports = {
  content: ["_site/**/*.html", "_site/**/*.js"],
  css: ["_site/assets/css/*.css"],
  output: "_site/assets/css/",
  skippedContentGlobs: ["_site/assets/**/*.html"],
  safelist: {
    standard: [/^home-/, /^research-motion-/, /^theme-/, /^is-/, /^fa-/, /^fa[srbl]?$/, /^ai-/, /^ninja-/],
    deep: [/^home-/, /^theme-/, /^research-motion-/, /^ninja-/],
    greedy: [
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
    ],
    keyframes: [/^home-/, /^site-/],
    variables: [/^--global-/, /^--home-/, /^--motion-/, /^--research-motion-/],
  },
};
