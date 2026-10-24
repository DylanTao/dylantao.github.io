# Sirui personal website design and measurement proposal

24 October 2026. For Sirui's review, not an implementation instruction until approved.

## Recommendation

Keep the site's established identity. Make its research easier to understand through concrete evidence earlier in the reading path, rather than adding a new visual theme or more explanatory sections. The strongest opportunity is to make the interface demonstrate Sirui's research judgment as clearly as the writing describes it.

This proposal builds on the repository's “Less, but more Sirui” direction, Inter typography, orange identity, coastal research-studio setting and locked research language. It does not replace those contracts. No production code, analytics settings or visitor data were changed or accessed for this review.

## What the existing site already does well

The reviewed main commit is `af3199147e5d77fcee881be618bd50a113a6c12f`. The primary contracts are [WEBSITE_DESIGN_HEURISTICS.md](../../../WEBSITE_DESIGN_HEURISTICS.md), [material-lite-revamp.md](../../material-lite-revamp.md) and [homepage-desk-scene-brief.md](../../homepage-desk-scene-brief.md).

The public desktop homepage was inspected in a cloud browser on 24 October. Its opening names the research concern, shows Sirui's portrait and academic context, and provides direct publication, project and contact routes. Its thesis and Design/Evaluate/Situate sections explain a coherent agenda. Selected papers already include real figures, resources, attribution and useful context. These are assets to strengthen, not replace with generic landing-page formulas.

The observed desktop sequence also contains several layers of research framing and a large abstract visualization before the selected-paper evidence. My design hypothesis is that a concrete example earlier would help a new academic reader connect the agenda to an actual contribution. This is a hypothesis from inspection, not a measured comprehension failure. This review did not establish mobile usability, all theme states or current visitor behavior.

## The academic adaptation

The video is about company websites. A personal research site has different successful visits: a researcher finds a relevant paper, a student understands the work, a hiring reader assesses contributions, or a collaborator decides whether to contact Sirui. A short visit that accomplishes one of these can be better than a long visit filled with decorative interactions.

Three distinctions should guide the adaptation:

- Preserve personality when it reveals the person or research practice. A playful inhabited studio is not automatically waste because it does not drive a sales conversion.
- Make credible evidence easy to inspect. Academic trust comes from accurate roles, collaborators, paper status, limitations and working resources, not enterprise badges or exaggerated impact claims.
- Give different readers clear paths. One primary action per local cluster is useful; one mandatory funnel for every visitor is not.

See [VIDEO_REVIEW.md](VIDEO_REVIEW.md) for the source-grounded episode findings, timestamps and coverage limits. The recommendations below are our application to this repository, not claims that the speakers evaluated this site.

## Proposed design language

**A thoughtful, inhabited research studio where design decisions become visible.** This is an internal design description, not a replacement homepage slogan.

1. **Warm but precise.** Use the existing orange and coastal supporting palette to orient attention, not to decorate every surface. Keep Inter and the established type hierarchy. A recognizable font is not evidence of AI authorship or poor design.
2. **Evidence before atmosphere when they compete.** Use authentic interface crops, annotated comparisons and research artifacts to explain the work. Ambient illustration can frame them, but should not require an extra screen of scrolling before a visitor encounters proof.
3. **Editorial hierarchy rather than container hierarchy.** Reserve cards for meaningful groups or actions. Distinguish headline, explanation, evidence caption and metadata through typography and spacing before introducing another border or badge.
4. **One characteristic annotation grammar.** Across project figures, use a consistent small numbered marker, short observation and linked explanation of why it matters. A repeatable way of showing research reasoning can become more distinctive than a novel background effect. Keep the original figure legible, credited and available uncropped.
5. **Motion explains a change.** Animate a real comparison, state transition or relationship when it helps understanding. Preserve native scrolling, reduced-motion behavior and immediate access to static evidence. No fake inputs, timed reading or mandatory animated introductions.
6. **Personal without becoming noisy.** Keep the portrait, occasional warm aside and optional studio discoveries. Concentrate delight in bounded places. Do not let a floating element obstruct a paper link, body text or keyboard focus.

Preserve the exact locked phrases, including “Making AI tools that sharpen design judgment.”, “Scaffolding taste in an age of generative abundance.”, “Design, Evaluate, Situate.”, “Vibes -> Variables -> Value” and “Make better design decisions visible.” Changes to their placement or supporting explanation should not silently rewrite them.

## A focused first implementation after approval

Avoid a site-wide revamp. First compare one revised homepage reading path with the current baseline. Start with one existing research figure, a source-checked caption and its resource route near the opening. Do not simultaneously reorder the entire homepage or apply annotations site-wide. The section sequence below describes a direction to assess, not a single all-at-once implementation.

**Opening:** preserve the current headline, portrait, affiliation and direct routes. Offer a compact, real research example in or immediately after the opening. For example, an existing DesignWeaver figure could show the dimensional palette with a short source-checked explanation of the design decision it supports. Do not invent a new result or imply an image alone demonstrates learning.

**Evidence:** bring a small selection of existing paper contributions forward. For each: the problem, a concrete interaction or artifact, Sirui's role, what the evidence supports, and a working resource link. Reuse the existing “when this paper helps” material rather than adding another summary layer. Keep complete author lists and detailed citation metadata available without making them the first thing a new reader must parse.

**Research agenda:** retain the thesis and Design/Evaluate/Situate framework, but connect each to the preceding concrete evidence. Remove repeated supporting explanation where it says the same thing twice. Keep the abstract visualization only where it adds an understandable relationship; it need not be deleted merely because it is expressive.

**Depth and personality:** provide publications, projects, CV, notes and studio exploration as clear optional continuations. Deep-linked paper visitors should not need to return to the homepage to understand or access a paper.

## What to measure

The companion [ANALYTICS_REVIEW.md](ANALYTICS_REVIEW.md) inventories current code and gives exact event definitions, denominators, privacy boundaries and official documentation. Its main recommendations are:

- **Understanding and findability:** a few task-based sessions with relevant readers. Can they explain the research concern, choose a relevant paper and identify the contribution and next resource? Record actual successes, failures and confusion, not a simulated reader's score as human evidence.
- **Useful resource access:** distinct measured sessions with an allowlisted paper/code/demo/citation action divided by sessions viewing relevant public research pages. An activation is not proof of reading, reuse or citation.
- **Relevant inquiries:** a private monthly count of actual site-assisted conversations where the connection is credible or volunteered. A contact-link click is not a sent email, and no personal inquiry content belongs in analytics.

Existing instrumentation needs an audit before expansion. The repository has custom timing, scroll and conditional search events. One event mixes load milliseconds with elapsed seconds; the blog counter labels pageviews as people reading. Verify collection and consent behavior, fix meanings and duplication, and preserve intentionally untracked features before adding at most two justified custom event gaps. Do not optimize raw dwell time or scroll counts.

Collect a dated baseline, annotate changes and compare similar acquisition/device contexts. Low traffic and changing audiences make short-window A/B claims unreliable. Pair aggregate trends with actual task feedback. Treat accessibility, broken links and Core Web Vitals as guardrails, not substitutes for research communication.

## Review and acceptance

Sirui's review should decide whether the earlier-evidence layout and consistent annotation treatment fit his taste. This document does not authorize silently replacing the existing brand rules or enabling new telemetry.

After approval, the laptop agent should inspect current main and concurrent work; implement one bounded slice; preserve the Human/AI routes, existing 2D/3D state, privacy contracts and locked phrases; run the repository's relevant checks; and compare actual desktop and phone renders. Verify keyboard access, reduced motion, Back/Forward, repeated navigation, resource links and contact behavior. Report what changed, what did not, exact tests and unresolved tradeoffs. Technical passes are not a claim that readers understand the site better.

## Short laptop handoff after review

Read `docs/design-reviews/2026-10-24/DESIGN_REVIEW.md` and its video and analytics companions on main. Apply only Sirui's approved recommendations to the existing site, preserving canonical brand rules, locked copy, concurrent changes and privacy contracts. Prioritize earlier concrete research evidence and clearer reading order, not a new theme. Audit existing measurement before adding events. Test the affected desktop/phone journeys and report before/after evidence, exact checks and remaining limitations.

## Review validation

This is a documentation-only proposal. Source links and reviewed commit are recorded. The companion analytics review ran 11 isolated existing JavaScript tests successfully; those do not validate live GA collection. No full Jekyll build or implementation regression suite was run for this proposal, and no live analytics or measured comprehension results are asserted.
