#!/usr/bin/env node
// The PDF is a projection of the same public resume used by the web CV.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, process.argv[2] || "assets/pdf/Sirui_Tao_CV_Public.pdf");
const temp = path.resolve(root, ".jekyll-cache/cv-pdf");
const raw = await fs.readFile(path.join(root, "assets/json/resume.json"));
const cv = JSON.parse(raw);
const knownSections = [
  "basics",
  "education",
  "academia",
  "teaching",
  "work",
  "volunteer",
  "awards",
  "certificates",
  "publications",
  "mentorship",
  "academicService",
  "cvNote",
  "skills",
  "languages",
  "interests",
  "references",
  "projects",
];
if (Object.keys(cv).some((key) => !knownSections.includes(key)) || cv.certificates.length)
  throw new Error("A new CV section needs an explicit print layout before publishing.");
if (!raw.equals(await fs.readFile(path.join(root, "_data/resume.json")))) {
  throw new Error("The public and Jekyll resume sources differ; reconcile them first.");
}
const esc = (value = "") => String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const absolute = (url) => {
  const resolved = new URL(url, cv.basics.url);
  if (!["https:", "http:", "mailto:"].includes(resolved.protocol)) throw new Error(`Unsupported public CV link protocol: ${resolved.protocol}`);
  return resolved.href;
};
const link = (label, url) => `<a href="${esc(absolute(url))}">${esc(label)}</a>`;
// Only the existing anchor syntax in the public record is accepted as markup.
function rich(value = "") {
  const parts = String(value).split(/(<a\b[^>]*>.*?<\/a>|\[[^\]]+\]\(https?:\/\/[^)]+\))/gi);
  return parts
    .map((part) => {
      const html = part.match(/^<a\b[^>]*href=['"]([^'"]+)['"][^>]*>(.*?)<\/a>$/i);
      const markdown = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      return html ? link(html[2], html[1]) : markdown ? link(markdown[1], markdown[2]) : esc(part);
    })
    .join("");
}
const dates = (entry) => [entry.startDate, entry.endDate].filter(Boolean).join(" - ");
const p = (value, cls = "") => (value ? `<p${cls ? ` class="${cls}"` : ""}>${value}</p>` : "");
const row = (label, body, cls = "") => `<div class="entry ${cls}"><div class="date">${esc(label)}</div><div class="entry-body">${body}</div></div>`;
const section = (title, body, id) => `<section${id ? ` id="${id}"` : ""}><h2>${esc(title)}</h2>${body}</section>`;
const name = (entry) => (entry.url ? link(entry.name || entry.organization, entry.url) : esc(entry.name || entry.organization));
const job = (entry) =>
  row(
    dates(entry),
    p(`<strong>${name(entry)}</strong> - ${esc(entry.position)}${entry.location ? ` <span class="location">(${esc(entry.location)})</span>` : ""}`) +
      p(rich(entry.summary)) +
      (entry.highlights?.length ? `<ul>${entry.highlights.map((h) => `<li>${rich(h)}</li>`).join("")}</ul>` : "")
  );
if (new Set(cv.education.map((e) => `${e.institution}|${e.location}`)).size !== 1)
  throw new Error("The shared education heading must be revised for different institutions or locations.");
const education = section(
  "Education",
  `<p class="shared-institution"><strong>${esc(cv.education[0].institution)}</strong> - ${esc(cv.education[0].location)}</p>` +
    cv.education
      .map((e) =>
        row(
          dates(e),
          p(`<strong>${link(e.studyType, e.url)} - ${esc(e.area)}</strong>`) +
            p(`${esc(e.courses)}. Advised by ${e.advisors.map((a) => link(a.name, a.url)).join(" and ")}.`)
        )
      )
      .join("")
);
const publications = section(
  "Publications (& Rejections)",
  cv.publications
    .map((e) =>
      row(
        `[${e.paperLabel}]`,
        p(`<strong><em>${e.strikeTitle ? `<s>${esc(e.name)}</s>` : esc(e.name)}</em></strong>`) +
          p(esc(e.summary).replace(/Sirui Tao/g, "<strong>Sirui Tao</strong>")) +
          p(
            `${esc(e.publisher)}${e.publisher.includes(e.releaseDate) ? "" : ` (${esc(e.releaseDate)})`}.${e.url ? ` ${link("[link]", e.url)}` : ""}${e.rejectionNote ? ` <strong>${esc(e.rejectionNote)}</strong>` : ""}`
          ),
        "publication"
      )
    )
    .join("")
);
const academia = section("Research Experience", cv.academia.map(job).join(""));
const work = section("Industry Experience", cv.work.map(job).join(""));
const teaching = section(
  "Teaching Experience",
  cv.teaching
    .map((e) => row(dates(e), p(`<strong>${esc(e.position)}</strong> - ${link(e.name, e.url)}`) + p(`${esc(e.summary)}; ${esc(e.location)}.`)))
    .join("")
);
const mentorship = section(
  "Research Mentorship",
  cv.mentorship
    .map((e) =>
      row(
        e.status === "current" ? "Current" : "Alumni",
        p(`${name(e)}, ${esc(e.details)} <a class="paper-ref" href="#${esc(e.paperAnchor)}">[${esc(e.paperLabel)}]</a>`),
        "compact-mentor"
      )
    )
    .join("")
);
const service = section(
  "Academic Service",
  cv.academicService.map((e) => row(e.date, p(`${esc(e.title)}${e.summary ? `: ${esc(e.summary)}` : ""}`))).join("")
);
const volunteering = section("Volunteering", cv.volunteer.map(job).join(""));
const awards = section(
  "Honors & Awards (& Rejections)",
  cv.awards
    .map((e) =>
      row(
        e.date,
        p(
          `${e.strikeTitle ? `<s>${link(e.title, e.url)}</s>` : link(e.title, e.url)} - ${esc(e.awarder)}${e.rejectionNote ? ` <strong>${esc(e.rejectionNote)}</strong>` : ""}${e.summary ? `<br>${rich(e.summary)}` : ""}`
        )
      )
    )
    .join("")
);
const projects = section(
  "Projects",
  cv.projects.map((e) => row(e.year, p(`<strong>${name(e)}</strong> - ${esc(e.role)}`) + p(rich(e.summary)))).join("")
);
const skills = section("Skills", cv.skills.map((e) => row(e.name, p(e.keywords.map(esc).join(", ")), "skill-row")).join(""));
const languages = section("Languages", p(cv.languages.map((e) => `${esc(e.language)} (${esc(e.fluency)})`).join("; ")));
const interests = section("Interests", cv.interests.map((e) => p(`<strong>${esc(e.name)}:</strong> ${e.keywords.map(esc).join(", ")}`)).join(""));
const references = section("References", cv.references.map((e) => p(`${link(e.name, e.url)} - ${esc(e.reference)}`)).join(""));
const note = section("Note", p(rich(cv.cvNote)));
const contact = [
  esc(
    [cv.basics.location.address, cv.basics.location.city, cv.basics.location.postalCode, cv.basics.location.countryCode].filter(Boolean).join(", ")
  ),
  link(cv.basics.email, `mailto:${cv.basics.email}`),
  link("dylantao.github.io", cv.basics.url),
  ...cv.basics.profiles.map((e) => link(e.network, e.url)),
].join(' <span aria-hidden="true">|</span> ');
const pages = [
  `<header><h1>${esc(cv.basics.name)}</h1><p class="identity">${esc(cv.basics.label)}</p><p class="contact">${contact}</p><p class="summary">${esc(cv.basics.summary)}</p></header>${education}${publications}${mentorship}`,
  `${academia}${work}${volunteering}`,
  `${teaching}${service}${projects}`,
  `${awards}${skills}${languages}${interests}${references}${note}`,
];
const fonts = pathToFileURL(path.join(root, "artwork/cv/fonts/")).href;
const css = `
@font-face { font-family: Nunito; src: url('${fonts}Nunito-regular.ttf'); }
@font-face { font-family: Nunito; src: url('${fonts}Nunito-bold.ttf'); font-weight:700; }
@font-face { font-family: Nunito; src: url('${fonts}Nunito-italic.ttf'); font-style:italic; }
@font-face { font-family: Nunito; src: url('${fonts}Nunito-boldItalic.ttf'); font-weight:700; font-style:italic; }
@font-face { font-family: Raleway; src: url('${fonts}Raleway-bold.ttf'); font-weight:700; }
@page { size:Letter; margin:30pt 32pt; }
* { box-sizing:border-box; } body { margin:0; color:#171717; font:9pt/1.27 Nunito,sans-serif; }
.page { width:548pt; break-after:page; } .page:last-child { break-after:auto; }
h1 { font:700 21pt/1.1 Nunito,sans-serif; margin:0 0 5pt; }
header { margin-left:68pt; } .identity { font-size:10pt; margin-bottom:4pt; }
p { margin:0 0 2.2pt; } .contact { font-size:8pt; line-height:1.4; margin-bottom:7pt; }
.contact span { margin:0 3pt; } .summary { margin:0 0 11pt; }
section { margin:0 0 10pt; } h2 { font:700 11pt/1.2 Raleway,sans-serif; margin:0 0 6pt 68pt; padding:0 0 4pt; border-bottom:.65pt solid #282828; break-after:avoid; }
.entry { display:grid; grid-template-columns:60pt minmax(0,1fr); gap:8pt; margin-bottom:6pt; break-inside:avoid; }
.date { color:#383838; font-size:8pt; line-height:1.35; padding-top:.4pt; }
.entry-body { min-width:0; } .location { color:#444; font-size:8pt; }
.shared-institution { margin:0 0 5pt 68pt; }
.compact-mentor { margin-bottom:1pt; } .compact-mentor p { margin-bottom:0; }
.skill-row { grid-template-columns:94pt minmax(0,1fr); }
.publication { margin-bottom:9pt; } a { color:#064db2; text-decoration:none; } .publication strong a { color:inherit; }
ul { margin:2pt 0 0; padding-left:12pt; } li { margin-bottom:1pt; }
.page-3 .entry { margin-bottom:4pt; } .page-3 h2 { margin-bottom:5pt; }
.page-4 { font-size:8.5pt; } .page-4 .entry { margin-bottom:4pt; } .page-4 section { margin-bottom:8pt; }
.page-4 section:nth-child(n+3) { margin-left:68pt; } .page-4 section:nth-child(n+3) h2 { margin-left:0; }
`;
// Publication destinations are native PDF links as well as HTML anchors.
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sirui Tao CV</title><style>${css}</style></head><body>${pages.map((body, i) => `<main class="page page-${i + 1}">${body}</main>`).join("")}</body></html>`;
cv.publications.forEach((e) => {
  html = html.replace(
    `<div class="entry publication"><div class="date">[${e.paperLabel}]`,
    `<div id="${e.anchor}" class="entry publication"><div class="date">[${e.paperLabel}]`
  );
});
await fs.mkdir(temp, { recursive: true });
await fs.mkdir(path.dirname(output), { recursive: true });
const htmlPath = path.join(temp, "Sirui_Tao_CV_Public.html");
await fs.writeFile(htmlPath, html);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href);
  await page.emulateMedia({ media: "print" });
  await page.evaluate(async () => {
    await Promise.all([...document.fonts].map((font) => font.load()));
    await document.fonts.ready;
  });
  const fontStatus = await page.evaluate(() => [...document.fonts].map((font) => ({ family: font.family, status: font.status })));
  if (fontStatus.some((font) => font.status !== "loaded")) throw new Error(`A CV font did not load: ${JSON.stringify(fontStatus)}`);
  const metrics = await page.locator(".page").evaluateAll((nodes) =>
    nodes.map((el) => ({
      height: el.getBoundingClientRect().height,
      bottom: el.lastElementChild.getBoundingClientRect().bottom - el.getBoundingClientRect().top,
    }))
  );
  // Letter has 732pt usable height with these margins. Never shrink text to hide an overflow.
  if (metrics.some((m) => m.height > 976.5 || m.bottom > 976.5))
    throw new Error(`A CV page exceeds the authored Letter area: ${JSON.stringify(metrics)}`);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  const pageCount = (pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length;
  if (pageCount !== 4)
    throw new Error(`The composed CV has ${pageCount} pages, expected four; inspect fragmentation before replacing the public PDF.`);
  await fs.writeFile(output, pdf);
  const receipt = {
    // Git's Windows checkout may use CRLF; no other content normalization is allowed.
    resume_lf_sha256: createHash("sha256").update(raw.toString("utf8").replaceAll("\r\n", "\n")).digest("hex"),
    pdf_sha256: createHash("sha256")
      .update(await fs.readFile(output))
      .digest("hex"),
    pages: metrics,
    output: path.relative(root, output).replaceAll(path.sep, "/"),
    records: Object.fromEntries(
      Object.entries(cv)
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => [key, value.length])
    ),
  };
  await fs.writeFile(path.join(temp, "build-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  if (output === path.join(root, "assets/pdf/Sirui_Tao_CV_Public.pdf"))
    await fs.writeFile(path.join(root, "artwork/cv/build-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser.close();
}
