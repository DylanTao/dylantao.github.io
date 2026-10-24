# Academic-site analytics review and measurement plan

**Sirui Tao · dylantao.github.io · 24 October 2026**

**Original review status: proposal for Sirui's review, not an implementation.** The inventory below used repository and primary documentation only. At that checkpoint no tracking, GA settings, website, GitHub issue, commit, or deployment was changed, and no GA account, raw visitor records or Search Console report was accessed.

**October 24 continuation:** Sirui subsequently authorized aggregate GA4 reporting. [Local read-only reporting](../../ga4-readonly-analysis.md) and its first historical export are complete; reports and executed analysis stay private and ignored. This resolves the access question below. It does not enact the proposed instrumentation, audit consent/settings, establish conversion, or supply Search Console visibility data. Collection remains unchanged.

## October 24 counter-label correction

The separate blog counter reads `page_pv` but called the result "people read it."
That field does not establish distinct people or completed reading. Its display
now says `1 view` / `1,234 views`; only the formatting line in
`assets/js/blog-read-counter.js` changes. GET display groups, POST increment,
credentials, caching, local-preview exclusion and failure hiding stay intact.
The decision whether to keep that third-party counter remains separate.

**All counts in these captures are synthetic test values, not audience evidence.**
Eleven focused iteration checks use real blog/post routes and assets, fulfilling
the API locally and overriding only the intended changed script for the after
state. The mobile index and post cover singular/plural output; the desktop post
also checks the plural. No counter requests leave the browser. Native links are
identical before/after; overflow and runtime errors are absent. Malformed data
still hides the counter and wrapper. The deployed check below separately verifies
the newly built script on the live route.

| Synthetic state     | Before                                               | After                                              |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Mobile index, 1,234 | [Before](counter-evidence/before-index-390-many.png) | [After](counter-evidence/after-index-390-many.png) |
| Mobile post, 1      | [Before](counter-evidence/before-post-390-one.png)   | [After](counter-evidence/after-post-390-one.png)   |

The [verification receipt](counter-evidence/verification.json) records the actual
routes, supplied responses, unchanged request semantics, source/served-script
hashes and checked links. Production's original script is minified, so its byte
hash is recorded separately from canonical unminified source. No real GA data
or credentials are included. The shorter truthful label makes no claim of more
traffic, better engagement or improved reading.

### Deployed verification

The [live receipt](counter-evidence/live-verification.json) covers all six states
on source `b66903e74a95a9b545611bbe6705d27d68b2f1fa`, served by Pages commit
`20bdc88eb70c3afe47886b8de2f829a56cee46d9`. There is no script override. The actual
browser-loaded, minified counter script matches that exact Pages artifact in every
case (SHA256 `7c6c3e598a308b56bd5c7dcb33147f158c4edd9812aed9a02d9d685a44e764dc`).
Mobile index/post singular and plural, desktop post plural, and malformed-data
hiding pass with native links, unchanged GET/POST semantics, zero overflow and
no runtime errors. The [deployed mobile post](counter-evidence/live-post-390-one.png)
shows the synthetic `1 view` state. The API is fulfilled locally; these checks send
no real counter increments or analytics and make no audience claim.

The initial live attempt passed three states, then stopped on a generic console
HTTP 503. Its URL was not recorded, so the source is unknown. One diagnostic retry
added response-URL logging and preserved per-case progress; all six states passed
with no failed responses. No runtime code changed in response. The original
failure and both runs remain in ignored cache. This bounded retry does not
establish endpoint or network reliability.

## The decision

This should not become a sales funnel. The site's useful outcomes are:

1. A relevant visitor can explain what Sirui studies and why a particular contribution matters.
2. They can find the right paper, project, code, citation, or practical resource without fighting the interface.
3. A potential collaborator, student, or academic hiring reader can assess fit and choose a credible next step.

A quick successful visit can be better than a long confusing one. Preserve the academic voice and optional playfulness; do not optimize for more scrolling, more clicks, longer dwell time, or animation interactions as ends in themselves.

**Recommendation:** first verify what existing GA events mean and whether collection respects the chosen privacy boundary. Then combine a small outcome scorecard with task-based feedback. Add only the instrumentation that answers a concrete unanswered question.

## 1. What the repository actually establishes

Review pinned to main commit **af3199147e5d77fcee881be618bd50a113a6c12f**, confirmed through GitHub's refs API. Code search was useful for discovery but indexed an older commit, 4815ae89; consequential findings below were checked against pinned file contents.

| Finding                                                                                                                   | Repository evidence                                                                                                                                                                                                                                                                                                                                                                                                                                   | Interpretation and limit                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Analytics is configured on; other listed analytics-provider flags are off. The cookie-consent feature flag is off. | [Configuration, lines 557–563](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/_config.yml#L557-L563)                                                                                                                                                                                                                                                                                                    | Configuration is not evidence of events reaching a particular GA property, nor a legal compliance determination. The measurement ID is intentionally omitted here.                                                                                                                                                                             |
| Early GA queue exists; provider delivery is delegated to the analytics plugin.                                            | [head, lines 7–18](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/_includes/head.liquid#L7-L18); [scripts, lines 180–187](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/_includes/scripts.liquid#L180-L187); [GA setup](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/_scripts/google-analytics-setup.js) | A defined `gtag` can be only a queue; its presence does not prove collection. Plugin-owned generated output and actual browser requests still need verification.                                                                                                                                                                               |
| Custom events already exist, despite the generic analytics guide not listing them.                                        | [seo-optimization.js](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/assets/js/seo-optimization.js); [unconditional include, lines 16–17](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/_includes/scripts.liquid#L16-L17)                                                                                                                                | Do not describe the current site as pageviews-only or introduce a second overlapping tracking layer without auditing this helper.                                                                                                                                                                                                              |
| Existing load and elapsed-time measurements share one event name and one value field, but use different units.            | [load timing, lines 17–43](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/assets/js/seo-optimization.js#L17-L43); [time-on-page, lines 91–103](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/assets/js/seo-optimization.js#L91-L103)                                                                                                                     | `timing_complete/name=page_load` is navigation load completion in milliseconds; `name=time_on_page` is elapsed seconds at `beforeunload`. Never aggregate their `value` together. Elapsed time includes time without attention; exit delivery is not established. Neither measure is comprehension or a Core Web Vital.                        |
| Existing scroll events fire at 25/50/75/100%, once per threshold per page.                                                | [lines 71–114](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/assets/js/seo-optimization.js#L71-L114)                                                                                                                                                                                                                                                                                                   | `scroll_depth` is a viewport-position diagnostic. A large scroll jump emits several thresholds; event totals must not be called readers or successes.                                                                                                                                                                                          |
| A raw-query search event exists, but its live UI coverage is not established.                                             | [lines 117–150](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/assets/js/seo-optimization.js#L117-L150); [search setup](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/assets/js/search-setup.js); [bibliography search](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/assets/js/bibsearch.js)             | The helper sends `search/search_term` on Enter in `#search-input`. Inspected public search code uses `ninja-keys` and `#bibsearch`. Indexed matches for `#search-input` were the helper and its test mock. This is a possible selector mismatch, not proof that no search events ever arrive. Do not repair by transmitting free-form queries. |
| Unit tests cover timing, scroll thresholds, initialization, and the mocked search event.                                  | [seo tests](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/test/seo-optimization.test.mjs)                                                                                                                                                                                                                                                                                                              | All 11 source tests passed when run on isolated temporary copies of the pinned helper and test file using `node --test test/seo-optimization.test.mjs`. This checks mocked JavaScript behavior, not actual browser, GA ingestion, or consent behavior. No repository files were changed.                                                       |
| Public publication pages already expose research-useful destinations.                                                     | [publication resources, lines 24–43](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/_layouts/publication.liquid#L24-L43); [bibliography resource buttons](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/_layouts/bib.liquid#L374-L452)                                                                                                                   | PDF, DOI, arXiv, paper site, code, Markdown, BibTeX, and RIS are better outcome candidates than decorative interaction counts. They are still access attempts, not proof of reading, reuse, or citation.                                                                                                                                       |
| The publication constellation has an explicit no-analytics runtime test.                                                  | [test, lines 251–284](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/test/test_publication_constellation.py#L251-L284)                                                                                                                                                                                                                                                                                  | Preserve this privacy contract. Do not add tracking to constellation nodes, anonymous future-work records, or infer unpublished work from UI interactions. Measure public resource destinations elsewhere.                                                                                                                                     |
| The blog read counter is a separate measurement system.                                                                   | [blog-read-counter.js](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/assets/js/blog-read-counter.js)                                                                                                                                                                                                                                                                                                   | It reads `page_pv` from a third party but labels it “people read it”; source does not establish unique people or completed reads. It has a localhost/file-preview exclusion and separate credentialed requests. Review truthful labeling and privacy inventory; do not use it as a reading KPI.                                                |

The existing [SEO outcome guidance](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/docs/SEO.md#L53-L63) already distinguishes availability, visibility, useful visits, and inquiry quality, and rejects short-window causal claims. Build on that rather than importing commercial landing-page assumptions.

[ANALYTICS.md](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/docs/ANALYTICS.md) is generic setup guidance, not a complete event inventory or proof of privacy compliance. Its blanket provider/legal statements should not substitute for a review of actual configuration and applicable requirements.

### Consent, developer traffic, and source limits

- The inspected GA helper and SEO helper do not themselves check a production-host allowlist, developer status, or consent before queueing their events. Indexed searches found no `traffic_type` or `debug_mode` matches. **GA-admin filters may nevertheless exist; they were not accessible.**
- Cookie-consent scaffolding exists in [\_scripts/cookie-consent-setup.js](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/_scripts/cookie-consent-setup.js), and the [Distill include](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/_includes/distill_scripts.liquid#L193-L220) conditionally gates scripts. The feature is currently disabled in the reviewed configuration. Merely enabling the flag would not establish safe behavior across every layout.
- In particular, the early queue plus unconditional custom-event helper creates a **test question**: could pre-consent events be queued and later replayed? This review did not observe that behavior.
- Some repository capture tools suppress analytics in their own tests, but that does not establish global development filtering.
- Visitor records were not accessed. This is a bounded public-source review, not an exhaustive privacy audit of every site feature or upstream plugin.

## 2. A small academic outcome scorecard

Use three primary outcomes. Keep diagnostics subordinate to them.

| Outcome                                    | Definition and denominator                                                                                                                                                                                                                                                                                                                                                               | Decision it can inform                                                                                 | Main limitation                                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Research comprehension and findability** | In short moderated tasks, participants who correctly explain the research focus or select an appropriate paper/resource, divided by participants attempting that task. Record numerator/denominator, task, relevant audience, and concrete confusion.                                                                                                                                    | Improve the research summary, “when this paper helps” copy, labels, or route ordering.                 | A small recruited sample is qualitative evidence, not a population conversion rate.                                                                             |
| **Useful research-resource access**        | Distinct measured sessions with at least one allowlisted public research-resource action after a relevant public research page view, divided by distinct measured sessions with such a view. Include homepage research entry, publications, public paper context, and research-project pages; maintain an explicit route list. Report per-resource-type counts beside the combined rate. | Diagnose whether visitors can get from research explanation to PDF, code, demo, or citation resources. | Observed/consented sessions only. A link action is not a completed download, read, code use, or citation. Deep-link visitors need not follow a homepage funnel. |
| **Useful relationship outcomes**           | Private monthly count of actual relevant collaboration/student/hiring inquiries that voluntarily mention the site or are otherwise credibly site-assisted. Deduplicate conversations locally; classify only broad purpose. No reliable visitor denominator initially.                                                                                                                    | Assess whether fit and contact guidance help the right people decide to reach out.                     | Self-report is incomplete and attribution weak. Keep personal content out of GA and public reports; never imply click-to-inquiry linkage.                       |

**Two diagnostic families:**

- **Navigation:** sessions reaching public paper/project detail pages or the CV from a relevant landing page; resource access by landing route, broad source/medium, and device class. This is wayfinding evidence, not “quality of person” scoring. Do not infer visitor academic role from browsing.
- **Contact intent:** sessions with an explicit contact action divided by sessions on pages that provide that action. This is an action-available denominator, not proof the contact section was viewed. Email activation or copy success is not a sent email or inquiry.

**Two guardrails:**

1. Technical/accessibility reliability: mobile performance, broken public research links, keyboard navigation, reduced-motion behavior, and successful resource opening.
2. Measurement/privacy quality: duplicate events, accidental PII, collection after rejection/withdrawal, developer contamination, and transparent coverage limits.

Do not set arbitrary “increase engagement by 20%” targets before a valid baseline. A clearer site may reduce time-on-site or internal clicks while improving task completion.

## 3. Minimal event plan — reuse before adding

First inspect the actual GA web-stream settings and events. Google documents enhanced events for outbound `click`, supported file-extension `file_download`, 90%-depth `scroll`, and query-parameter-based `view_search_results`; enabled coverage must be checked for this property. BibTeX, RIS, and Markdown extensions are not in Google's documented default download list. [Google: enhanced measurement](https://support.google.com/analytics/answer/9216061?hl=en)

| Canonical reporting action                        | Collection source                                                                                                                        | Trigger and safe dimensions                                                                                                                                                                                                                                                                                                                                                                                    | Counting rule                                                                                                                                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public page arrival                               | Existing `page_view`                                                                                                                     | Public normalized route; optional allowlisted `content_group` such as home/publications/paper/project/cv/blog. No free-form query or private route names.                                                                                                                                                                                                                                                      | Use unique sessions for outcome rates. Do not manually add a second pageview.                                                                                                                                                                   |
| Public research-resource access                   | Existing `file_download` or outbound `click`, where verified; **new `resource_open` only for uncovered, explicitly allowlisted actions** | Link activation to a known public paper/resource. Maintain a public destination-to-`content_id`/`resource_type` reporting map; enhanced events do not automatically contain these custom IDs. Verify the needed safe destination fields are available before promising this breakdown. Custom parameters: public content ID, resource type, source surface, schema version. No raw arbitrary URL or link text. | If outbound PDF causes both enhanced events, assign the reporting action to `file_download` and exclude its overlapping `click`. Custom fallback must not fire on already-covered actions. Rate numerator is distinct sessions, not event sums. |
| Contact intent                                    | Proposed `contact_intent`                                                                                                                | Explicit email-link activation or successful email-copy action, using only method=`mail_open` or `email_copy` and a bounded surface label.                                                                                                                                                                                                                                                                     | One reporting success per session; no email address, mailto URL, subject/body, or visitor text. Do not call this `generate_lead` or an actual inquiry.                                                                                          |
| Public paper/project choice, only if needed later | Optional `research_select`                                                                                                               | Internal public detail link activation from a defined list/home/search surface. Exclude constellation/future-work interactions.                                                                                                                                                                                                                                                                                | Add only if page-arrival paths cannot answer a specific navigation question; never as an overall “more clicks” goal.                                                                                                                            |

Start with **at most two new custom events**: uncovered `resource_open` and `contact_intent`. They are proposals, not claims of current instrumentation.

Further details:

- A click to a local PDF may be captured even though the PDF itself has no tag. A direct external entry to a PDF is not established by the website's click event. Treat off-site reading/reuse as unobservable unless separately and appropriately measured.
- If automatic outbound/download collection cannot satisfy the privacy allowlist, choose a safe custom alternative for that category and disable its overlapping automatic category after review. Do not run both indiscriminately.
- Add search diagnostics only if observed task problems justify them: interface type and coarse result-count/zero-result outcome, not query text or keystrokes. The existing raw-query sender should be reviewed rather than connected to more inputs.
- Do not track every accordion, hover, theme toggle, scene gesture, or playful discovery. Optional delight may stay deliberately unmeasured.
- Preserve historical events rather than silently renaming their meaning. Document a measurement-version/change date; do not join incompatible old and new series as if continuous.

GA4 **key events** are selected important events, not a synonym for all interaction. Once verified, Sirui may choose contact intent and a narrowly defined resource-access outcome as proxy key events. Use session-level rates and keep actual inquiries separate. Avoid marking scroll, load timing, or every outbound link as key. [Google: key events](https://support.google.com/analytics/answer/9267568?hl=en)

GA4's engaged-session rule includes a session lasting over 10 seconds, a key event, or at least two page/screen views. Changing key-event definitions therefore changes engagement rate even without an experience improvement. Annotate such changes. [Google: engagement and bounce rate](https://support.google.com/analytics/answer/12195621?hl=en) GA engagement time describes time with the webpage in focus; prefer that diagnostic over the site's elapsed `beforeunload` clock, but neither proves understanding. [Google: user engagement](https://support.google.com/analytics/answer/11109416?hl=en)

## 4. Privacy and coverage before expansion

Recommended default for this academic site: minimal, non-advertising measurement, without cross-site profiling.

- Agree the consent approach and disclosure before expansion. Basic consent mode blocks Google tags until consent; advanced mode can send cookieless measurements while consent is denied. “No cookies” is not equivalent to “no collection.” Consent mode itself is not a consent banner or a compliance certificate. Do not enable advanced modeling just to fill gaps. [Google: consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- Gate event creation as well as transmission; do not retrospectively replay rejected/pre-consent actions. Verify accept, reject, withdraw, reload, and layout differences in a browser.
- No visitor email/name, free-form search text, contact text, precise location, fingerprinting, user-level identity joins, session replay, or heatmap recordings. No unpublished-work IDs, private destinations, or confidential manuscript hints. Review automatically included page URLs/titles/referrers too. Google's guidance specifically warns about PII in URLs and user-entered search/form text. [Google: avoid PII](https://support.google.com/analytics/answer/6366371?hl=en)
- Inspect retention, access, advertising links/signals, and data-redaction settings with Sirui. Use the shortest retention that supports the agreed question. These settings were not inspected here.
- Prefer production-only collection and separate local/preview QA. Test developer/internal/hostname filters before making irreversible exclusions. Do not exclude a broad campus IP range: that could remove genuine academic visitors. [Google: data filters](https://support.google.com/analytics/answer/13296761?hl=en); [internal traffic](https://support.google.com/analytics/answer/10104470?hl=en)
- Google excludes known bots automatically, but that is not proof all automation is absent; excluded known-bot volume is not available. [Google: bot exclusion](https://support.google.com/analytics/answer/9888366?hl=en)
- Report “measured sessions,” not “all visitors.” Rejection, blockers, JS failure, direct file entries, and missing tags produce coverage gaps. Do not estimate consent acceptance by dividing GA sessions by an unrelated counter. If no separately authorized aggregate denominator exists, state coverage unknown. Use aggregate GA session measures, not a new custom visitor identifier; avoid publishing sparse audience/device/source slices that could identify people.
- Separate observed from modeled data if modeling is present; eligibility depends on sufficient volume and must not be assumed on a small academic site. [Google: behavioral modeling](https://support.google.com/analytics/answer/11161109?hl=en-GB)

## 5. Technical performance: a parallel track, not a content-success substitute

Use current **Core Web Vitals** as guardrails: p75 LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1, split mobile/desktop. They measure loading, responsiveness, and layout stability; they do not measure scholarly value. The existing `page_load` event is not a substitute. [web.dev: Web Vitals](https://web.dev/articles/vitals)

Recommended measurement order:

1. Run a reproducible lab baseline on homepage, publications, one paper context page, one research project, CV, and a representative resource post. Keep device/network/cache conditions and route version with results. Check console errors and resource links, not just a composite score.
2. Inspect PageSpeed Insights/CrUX field evidence if available. Its field window is the preceding 28 days; low-volume pages may fall back to origin data or have no field data. Label page/origin/lab distinctly. [Google: PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/about)
3. Only if field diagnostics remain necessary and privacy approval covers them, consider a minimal Web Vitals collection path. Avoid detailed DOM attribution or arbitrary element text. Do not retrofit a performance tracker merely because it is possible.
4. After a targeted fix, repeat comparable lab checks and use available field trends as corroboration, not a single instant pass/fail causality claim. Lab and field results answer different questions. [web.dev: lab versus field](https://web.dev/articles/lab-and-field-data-differences)

The repository contains historical performance plans and evidence. Those are context, not a measurement of today's deployed site. This review ran no Lighthouse, CrUX, or real-user measurement.

## 6. A practical learning loop

### Stage A — verify and baseline

With Sirui's approval, inspect/export aggregate GA data for the last 90 days where available: acquisition, landing/pages, event list and parameters, key-event definitions, device split, enhanced-measurement toggles, property timezone, filters, consent behavior, and retention. Retain date range, definitions, thresholds/sampling notices, and any instrumentation changes. No visitor-level export is needed.

Do not infer historical availability of the proposed events. First establish what current reports can answer; use a new baseline for changed definitions.

Run a small task session with relevant readers, for example:

- “In your own words, what research question connects this work?”
- “You are interested in human–AI design/reasoning. Find the most relevant paper and explain why it fits, including one limitation.”
- “Find the paper's code or a usable citation.”
- “You are considering collaboration or joining a project. Find the fit guidance and the appropriate contact path.”

Agree a short rubric before testing: identify the research concern, explain one contribution, and distinguish what its evidence supports from what remains uncertain. Accept ordinary-language paraphrases; recalling locked slogans is not comprehension.

Observe wrong turns, ambiguous labels, missed resources, and ability to explain the research—not just speed. Recruit across relevant perspectives and device needs; do not present a handful of participants as statistically representative.

### Stage B — approved minimal implementation

Likely touch points, **not authorized changes in this review**:

- A small site-specific analytics adapter with consent, production-host, privacy allowlist, and schema-version checks.
- Public resource-link templates, using the existing canonical publication keys and safe resource types.
- Contact controls, with no destination or typed-content payload.
- Existing SEO helper semantics/search handling and documentation, preserving the non-analytics lazy-loading behavior.
- Relevant source tests plus browser/network tests; plugin changes routed under [AGENTS.md](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/AGENTS.md) and [BOUNDARIES.md](https://github.com/DylanTao/dylantao.github.io/blob/af3199147e5d77fcee881be618bd50a113a6c12f/docs/BOUNDARIES.md). Preserve the constellation's no-telemetry contract.

Acceptance evidence must show one intentional action produces one canonical reporting action, no unintended duplicate pageviews, safe bounded parameters, no tracking on protected/private surfaces or local previews, no collection under the chosen rejection boundary, and normal keyboard/mobile behavior. Browser request inspection is needed for rejection tests; an empty DebugView alone does not prove no traffic.

Use Tag Assistant/DebugView for only the tester's device and then verify report arrival. DebugView requires debug mode; consent/privacy controls can prevent events appearing there. Remove debug configuration after QA rather than leaving every visitor in debug mode. [Google: DebugView](https://support.google.com/analytics/answer/7201382?hl=en) Register only the small event-scoped custom dimensions needed for reporting; dispatching a parameter alone does not make it a usable custom report dimension. [Google: event parameters](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters)

### Stage C — sequenced changes, not premature A/B testing

Collect a stable initial learning window, provisionally four weeks, extending it if traffic is sparse. Choose one meaningful change at a time from observed friction:

| Hypothesis                                               | Evidence that would justify trying it                                                                                                                                                 | Success evidence                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Research framing is hard to understand.                  | Readers cannot articulate the question or distinguish paper contributions.                                                                                                            | Better task explanations and relevant paper choices; no accessibility/performance regression.             |
| Resource paths are difficult to find.                    | Observed task wrong turns or missed resources, corroborated where useful by aggregate paths. Low resource activation alone may reflect appropriate relevance filtering, not friction. | Clearer task completion plus a higher resource-access session rate within comparable entry/device groups. |
| Collaboration/participation guidance is vague.           | Readers understand the work but cannot judge fit or find the next step.                                                                                                               | Better task-level fit decisions, appropriate contact intent, and eventual relevant inquiries.             |
| Visual richness obstructs access on constrained devices. | Reproducible lab interaction delay/layout shifts and/or sufficient field evidence.                                                                                                    | Improved technical guardrails and maintained research access, without flattening the site's identity.     |

Annotate releases, paper announcements, conferences, recruitment periods, and source-mix changes. Compare equivalent periods and relevant landing/device/source groups; avoid a many-way segmented dashboard with tiny cells. Show raw numerator and denominator beside each rate. Use uncertainty intervals when volume permits, and say “insufficient evidence” rather than declaring a winner from a few actions.

A before/after improvement remains observational. A/B testing becomes appropriate only when baseline traffic, a worthwhile effect size, outcome rate, and a prospective power/duration calculation support it. Do not impose statistical machinery on a site where a few careful reader sessions would resolve the question faster.

## Review decisions still needed

1. Which audience/decision should lead the first learning cycle: research peers, potential collaborators, prospective students, or academic hiring readers?
2. Which public resource actions are genuinely useful, and should contact intent be a GA key event or only a diagnostic?
3. What privacy/consent boundary should the site enforce, and should the separate public read counter remain?
4. **Resolved for aggregate reporting on October 24:** Sirui authorized the dedicated property Viewer and the first read-only export. A settings/consent audit remains a separate question; no additional credentials or tracking changes are needed to finish this access task.

**Bottom line:** the repository already has more tracking than a generic setup guide suggests, but its existing events largely measure browser activity. The next improvement is not “track everything.” It is to make a few measures trustworthy, tie them to academic visitor tasks, and use them alongside qualitative evidence to choose restrained changes.
