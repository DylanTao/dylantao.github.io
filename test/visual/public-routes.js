const DEFAULT_PUBLIC_BASE_URL = "http://127.0.0.1:4000/al-folio";

const SITEWIDE_ROUTES = [
  {
    id: "home",
    path: "/",
    readySelector: "#home-title",
    contentSelector: ".home-page",
    fullPage: true,
  },
  {
    id: "blog-index",
    path: "/blog/",
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
    id: "projects-index",
    path: "/projects/",
    readySelector: ".projects [data-project-card-grid]",
    contentSelector: ".projects",
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
];

const DESK_ROUTE = SITEWIDE_ROUTES[0];

function getPublicBaseURL() {
  return process.env.VISUAL_BASE_URL || DEFAULT_PUBLIC_BASE_URL;
}

function publicRouteUrl(routePath, baseURL = getPublicBaseURL()) {
  const normalizedBase = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
  const normalizedPath = routePath.replace(/^\//, "");
  return new URL(normalizedPath, normalizedBase).toString();
}

module.exports = {
  DEFAULT_PUBLIC_BASE_URL,
  DESK_ROUTE,
  SITEWIDE_ROUTES,
  getPublicBaseURL,
  publicRouteUrl,
};
