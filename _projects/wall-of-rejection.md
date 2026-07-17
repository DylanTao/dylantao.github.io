---
layout: page
title: Wall of Rejection
description: A rejection-only receipt wall that makes failed submissions visible without turning research life into a leaderboard.
img: assets/img/project_pics/site-experiments/wall-of-rejection.png
image_aspect: 4 / 3
card_image_fit: contain
card_image_position: center
card_avoid_scaling: true
importance: -27
category: fun
site_experiment: true
debut_date: 2026-05-29T15:24:23-07:00
year: 2026
role: Designer, meme archivist
status: Living receipt wall
hide_title: true
---

<section class="project-case-hero site-experiment-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">Site experiment · first seen May 29, 2026</p>
    <h1>Wall of Rejection</h1>
    <p class="project-case-lede">
      CHI said no. UIST said no. A lab meme made that sting funny for a minute; the website version turned the joke into a rejection-only record with badges, nearby receipts, and one rule that matters: the same rejection event never earns points twice.
    </p>
    <div class="project-case-facts">
      <span>Rejection-only</span>
      <span>Receipts close by</span>
      <span>No double counting</span>
      <span>No leaderboard</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/publications/#wall-of-rejection-title' | relative_url }}">Open the wall</a>
      <a href="{{ '/assets/downloads/site-experiments/wall-of-rejection-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Wall of Rejection summary">
  <div><span>Why</span><p>Research pages make accepted work easy to see and can accidentally make the failed attempts disappear.</p></div>
  <div><span>What</span><p>Four selected rejection events become inspectable badges and receipts beside, but never inside, the accepted-paper record.</p></div>
  <div><span>How</span><p>XP is calculated from events once; shelves, repeated views, and the Double Rejection combo add no extra points.</p></div>
</section>

## Why it began

After one first-authored paper was rejected from CHI 2026 and UIST 2026, I made a Steam-style badge meme for labmates. The joke worked because it treated survival—not acceptance—as the achievement. It also exposed a gap in the publication page: the bibliography could show where work landed, but not the trying, revising, and trying again around it.

The website did not need a fake game profile. It needed a small place where selected failures could remain visible without competing with the scholarship. That changed the design question from “How do I reproduce the meme?” to “What is the smallest honest record the joke can carry?”

## What changed

<ol class="project-story-beats" aria-label="Wall of Rejection turning points">
  <li class="project-story-beat">
    <p class="project-case-kicker">Spark</p>
    <h3>A one-off lab meme</h3>
    <p>The original image held two rejection achievements inside an intentionally overbuilt Steam-style profile. It was funny as a message, not usable as a publication record.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Turn</p>
    <h3>Achievements became receipts</h3>
    <p>A generic review-achievement panel gave way to rejection-only events, quieter badges, and a receipt that keeps the date, stage, and explanation next to the selected no.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Now</p>
    <h3>The joke has an accounting rule</h3>
    <p>Four source events total 38 XP. Badges may appear on several shelves, and the Double Rejection combo can celebrate a pattern, but neither creates another failure.</p>
  </li>
</ol>

## From meme to receipt wall

<section
  class="project-story-comparison"
  aria-label="Original lab meme and current rejection wall"
  data-comparison-rubric="origin-image-to-rejection-only-runtime"
>
  <figure
    class="project-case-media site-experiment-evidence-figure"
    data-evidence-kind="origin-source-image"
    data-evidence-archive-commit="77b8efbca92bfe39b5f30d18b8429b67e0ae6a07"
    data-evidence-archive-date="2026-05-29"
    data-evidence-artifact-size="1672x941"
    data-evidence-capture-date="not-applicable"
    data-evidence-theme="not-applicable"
    data-evidence-state="not-applicable"
    data-evidence-source-viewport="not-applicable"
  >
    <img src="{{ '/assets/img/website-revamp/wall-of-rejection-steam-reference.png' | relative_url }}" alt="Original Steam-style lab meme showing CHI and UIST rejection achievement cards in a fictional HCI researcher profile" loading="lazy" width="1672" height="941">
    <figcaption><strong>Origin source.</strong> A supplied 1672 × 941 image, added at <code>77b8efbca</code> on May 29. It is a static lab meme, so viewport, theme, and interaction state do not apply. All precise profile statistics inside it are fictional joke copy, not measurements.</figcaption>
  </figure>
  <figure
    class="project-case-media site-experiment-evidence-figure"
    data-evidence-kind="runtime-crop"
    data-evidence-archive-commit="c23d42e9d52b41d795a8fbb0de962d7fe7466c3f"
    data-evidence-archive-date="2026-07-15"
    data-evidence-capture-date="2026-07-15"
    data-evidence-artifact-size="670x502"
    data-evidence-theme="light"
    data-evidence-state="highlights-chi-rejection-receipt-open"
    data-evidence-source-commit="not-recorded"
    data-evidence-source-viewport="not-recorded"
    data-evidence-browser="not-recorded"
  >
    <img src="{{ '/assets/img/project_pics/site-experiments/wall-of-rejection.png' | relative_url }}" alt="Light-theme Wall of Rejection with Highlights selected, CHI Rejection receipt open, four compact badge controls, and 38 of 50 Failure XP" loading="lazy" width="670" height="502">
    <figcaption><strong>Receipt wall.</strong> A 670 × 502 light-theme crop archived at <code>c23d42e9d</code> on July 15, with Highlights selected and the CHI receipt open. The source viewport and browser were not recorded.</figcaption>
  </figure>
</section>

The visual language changed completely, but the emotional unit stayed small: one “no,” one badge, one receipt, then back to the papers.

## How one no moves through the wall

The ledger currently contains two first-author paper rejections at 12 XP each, one grant rejection at 7 XP, and one fellowship rejection at 7 XP: <strong>38 XP from four events</strong>. Everything visible is projected from those events.

<ol class="project-storyboard" aria-label="Rejection event to non-additive combo">
  <li class="project-storyboard-step">
    <h3>Event</h3>
    <p>A selected decision enters once with a type, public source label, rejected status, XP value, and the badges it can support.</p>
  </li>
  <li class="project-storyboard-step">
    <h3>Badge</h3>
    <p>The event becomes a compact control such as CHI Rejection. The same badge can appear in Highlights, Papers, or CHI without becoming three events.</p>
  </li>
  <li class="project-storyboard-step">
    <h3>Receipt</h3>
    <p>Opening the badge reveals its date, decision stage, short reflection, and category tags. Evidence stays close enough to check without crowding every shelf.</p>
  </li>
  <li class="project-storyboard-step">
    <h3>Non-additive combo</h3>
    <p>Double Rejection connects the CHI and UIST pattern, then contributes <strong>0 XP</strong>. It celebrates the absurdity without counting either paper decision again.</p>
  </li>
</ol>

<aside class="project-story-note project-story-note--privacy" aria-labelledby="wall-boundary-title">
  <p class="project-case-kicker">Publication boundary</p>
  <h2 id="wall-boundary-title">Selected failures, not a hidden-paper index</h2>
  <p>The public wall includes only allowlisted rejection events and deliberately brief receipts. It does not publish the rejected paper’s title, draft content, collaborator notes, future venues, or every rejection in Sirui’s history. Accepted work remains in the bibliography, and accepted outcomes earn 0 XP here.</p>
</aside>

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="wall-technical-summary">Technical provenance and exact ledger</summary>
  <div class="project-story-disclosure-body" aria-labelledby="wall-technical-summary">
    <ul>
      <li><strong>Event source:</strong> <code>_data/wall_of_rejection.yml</code> separates source events, display badges, receipts, shelves, and joke metrics so repeated presentation cannot inflate the count.</li>
      <li><strong>Current math:</strong> CHI 2026 12 + UIST 2026 12 + MSR AI and the New Future of Work CFP 7 + MSR Fellowship 7 = 38 XP. Combo and milestone badges add 0.</li>
      <li><strong>Origin image:</strong> 1672 × 941, SHA-256 <code>dc4d4e79d5d6444867dfc56b7d436a6439226208b2885a34d37cf22bcb4c4271</code>, archived at <code>77b8efbca</code> on May 29.</li>
      <li><strong>Runtime crop:</strong> 670 × 502 light-theme Highlights state with the CHI receipt open, SHA-256 <code>95ef3942345477a49c5bb718b3b34a4111bd37d2876df0844953243c7da06206</code>, archived at <code>c23d42e9d</code> on July 15. Its source viewport and browser were not recorded.</li>
      <li><strong>Reading order:</strong> the wall remains secondary to the accepted-paper list; changing shelves reorganizes badges but never changes the event ledger or XP.</li>
    </ul>
    <ol class="site-experiment-ledger" aria-label="Wall of Rejection iteration record">
      <li><time datetime="2026-05-29">May 29</time><code>910f3c7f2</code><span>Replaced a generic review-achievement panel with rejection-only badges, receipts, and the first XP joke.</span></li>
      <li><time datetime="2026-05-29">May 29</time><code>77b8efbca</code><span>Restored the supplied lab meme as the real origin evidence instead of keeping a substitute.</span></li>
      <li><time datetime="2026-06-15">Jun 15</time><code>6ab847bcd</code><span>Separated source events from reusable badges, added grant and fellowship records, and made combo and milestone badges worth 0 XP.</span></li>
      <li><time datetime="2026-06-15">Jun 15</time><code>1dad10b5b</code><span>Added the rejection timeline and aligned the ledger with CV evidence while keeping accepted work out of the count.</span></li>
      <li><time datetime="2026-06-16">Jun 16</time><code>f51ff4f16</code><span>Quieted the evening hierarchy so the rejection wall stayed secondary to the papers.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>c23d42e9d</code><span>Archived the 670 × 502 current wall state for the project card and case-study evidence.</span></li>
    </ol>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="wall-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="wall-reproduce-title">Start with a truthful event ledger.</h2>
  <p>The guide separates events, badges, shelves, receipts, and joke metrics so another academic site can adapt the idea without copying this history or a platform UI.</p>
  <a href="{{ '/assets/downloads/site-experiments/wall-of-rejection-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credits and the next joke

The wall nods to [Bradley Voytek’s failure-CV tradition](https://voyteklab.com/members), Sirui’s own post-UIST badge meme, and the strange optimism of the [Spooder-Man trailer](https://youtu.be/f_Pcu6wTzoA?si=2FKEbhC8hkqildqC). Those references shaped the honesty and tone, not the final interface skin.

The wall carries the evidence ledger. [HCI Spooder-Man]({{ '/projects/hci-spooder-man/' | relative_url }}) follows what happened when the double rejection became a character, a trailer-shaped joke, and a remix kit.
