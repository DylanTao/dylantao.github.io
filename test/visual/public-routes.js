const DEFAULT_VISUAL_PORT = 4000;

function getVisualPort() {
  const parsedPort = Number(process.env.VISUAL_PORT || DEFAULT_VISUAL_PORT);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(`VISUAL_PORT must be an integer from 1 to 65535; received "${process.env.VISUAL_PORT}".`);
  }
  return parsedPort;
}

function usesExternalVisualServer() {
  return process.env.NO_WEBSERVER === "1";
}

// Keep the homepage last: its canvas/compositing work can leave Linux
// Chromium unable to capture the next image-heavy route in the same worker.
const SITEWIDE_ROUTES = [
  {
    id: "blog-index",
    path: "/blog/",
    readySelector: ".blog-index .header-bar",
    contentSelector: ".blog-index",
    fullPage: true,
  },
  {
    id: "blog-page-2",
    path: "/blog/page/2/",
    readySelector: ".blog-index .header-bar",
    contentSelector: ".blog-index",
    fullPage: true,
  },
  {
    id: "blog-research-skills",
    path: "/blog/2026/research-skills-starter-pack/",
    readySelector: ".blog-post .post-title",
    contentSelector: ".blog-post #markdown-content",
  },
  {
    id: "blog-distributed-cognition",
    path: "/blog/2026/specialists-generalists-ai-distributed-cognition/",
    readySelector: ".blog-post .post-title",
    contentSelector: ".blog-post #markdown-content",
  },
  {
    id: "projects-index",
    path: "/projects/",
    readySelector: ".projects [data-project-card-grid]",
    contentSelector: ".projects",
    fullPage: true,
  },
  {
    id: "publications",
    path: "/publications/",
    readySelector: "[data-publication-workbench]",
    contentSelector: "[data-publication-workbench]",
    fullPage: true,
  },
  {
    id: "ai-profile",
    path: "/ai/",
    readySelector: "[data-ai-view] .ai-profile-header",
    contentSelector: "[data-ai-view]",
    fullPage: true,
  },
  {
    id: "publication-context-designweaver",
    path: "/publications/designweaver/",
    readySelector: '[data-publication-context-page="tao2024designweaver"]',
    contentSelector: ".publication-context-page",
    fullPage: true,
  },
  {
    id: "cv",
    path: "/cv/",
    readySelector: ".cv .card",
    contentSelector: ".cv",
    fullPage: true,
  },
  {
    id: "news",
    path: "/news/",
    readySelector: ".news .news-timeline-item",
    contentSelector: ".news",
    fullPage: true,
  },
  {
    id: "github-activity",
    path: "/github-activity/",
    readySelector: "[data-github-activity][data-state='ready']",
    contentSelector: ".github-activity-page",
    fullPage: true,
  },
  {
    id: "blog-archive-2026",
    path: "/blog/2026/",
    readySelector: ".archive table tr",
    contentSelector: ".archive",
    fullPage: true,
  },
  {
    id: "project-designweaver",
    path: "/projects/designweaver/",
    readySelector: ".project-detail .project-case-hero",
    contentSelector: ".project-detail article",
  },
  {
    id: "project-website-revamp",
    path: "/projects/website-revamp/",
    readySelector: ".project-detail .project-case-hero",
    contentSelector: ".project-detail article",
  },
  {
    id: "project-paper-constellation",
    path: "/projects/paper-constellation/",
    readySelector: ".project-detail .project-case-hero",
    contentSelector: ".project-detail article",
  },
  {
    id: "project-build-rhythm",
    path: "/projects/build-rhythm/",
    readySelector: ".project-detail .project-case-hero",
    contentSelector: ".project-detail article",
  },
  {
    id: "project-ikea-project-cards",
    path: "/projects/ikea-project-cards/",
    readySelector: ".site-experiment-evidence-figure img",
    contentSelector: ".project-detail article",
  },
  {
    id: "secret-locked",
    path: "/blog/2026/sirui-research-thoughts/",
    readySelector: "#sirui-private-message",
    contentSelector: ".sirui-private-note",
    minContentHeight: 20,
  },
  {
    id: "home",
    path: "/",
    readySelector: "#home-title",
    contentSelector: ".home-page",
    fullPage: true,
  },
];

const DESK_ROUTE = SITEWIDE_ROUTES.find((route) => route.id === "home");

function getPublicBaseURL() {
  if (process.env.VISUAL_BASE_URL && !usesExternalVisualServer()) {
    throw new Error("VISUAL_BASE_URL requires NO_WEBSERVER=1 so Playwright cannot start one server and inspect another.");
  }
  return process.env.VISUAL_BASE_URL || `http://127.0.0.1:${getVisualPort()}/al-folio`;
}

function publicRouteUrl(routePath, baseURL = getPublicBaseURL()) {
  const normalizedBase = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
  const normalizedPath = routePath.replace(/^\//, "");
  return new URL(normalizedPath, normalizedBase).toString();
}

module.exports = {
  DEFAULT_VISUAL_PORT,
  DESK_ROUTE,
  SITEWIDE_ROUTES,
  getPublicBaseURL,
  getVisualPort,
  publicRouteUrl,
  usesExternalVisualServer,
};
