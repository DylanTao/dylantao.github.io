---
layout: page
title: Wall of Rejection
description: The Steam-style rejection meme I turned into a small public wall of badges, receipts, and deliberately silly Failure XP.
img: assets/img/project_pics/wall-of-rejection/wall-of-rejection-dd801b99ca-700-noon-highlights-chi-open.png
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
      Wall of Rejection began as the Steam-style badge meme I sent to labmates after CHI and UIST said no. I turned it into a small public record: pick a badge, read the rejection receipt, and collect deliberately silly Failure XP. The same rejection event never earns points twice.
    </p>
    <div class="project-case-facts">
      <span>Rejection receipts</span>
      <span>Event-based XP</span>
      <span>Non-additive combos</span>
      <span>Accepted papers stay primary</span>
    </div>
    <div class="project-case-actions">
      <a href="{{ '/publications/#wall-of-rejection-title' | relative_url }}">Open the wall</a>
      <a href="{{ '/assets/downloads/site-experiments/wall-of-rejection-reproduction.md' | relative_url }}" download>Download reproduction MD</a>
    </div>
  </div>
</section>

<section class="project-case-summary" aria-label="Wall of Rejection summary">
  <div><span>Why</span><p>The publication list showed where work landed, but hid the trying and revising around it.</p></div>
  <div><span>What</span><p>Four selected rejections, each with a badge and a short receipt beside the accepted papers.</p></div>
  <div><span>Try</span><p>Open a badge, move between shelves, and check that the 38 XP total never changes.</p></div>
</section>

## Why it began

After one first-authored paper was rejected from CHI 2026 and UIST 2026, I made a Steam-style badge meme for labmates. The joke treated surviving the reviews—not getting accepted—as the achievement. It also pointed to something missing from the publication page: the bibliography showed where work landed, but none of the attempts around it.

For the website, I kept the joke small: selected public rejections beside the scholarship, with enough detail to understand each “no.”

## What changed

<ol class="project-story-beats" aria-label="Wall of Rejection turning points">
  <li class="project-story-beat">
    <p class="project-case-kicker">Original</p>
    <h3>The lab meme made two rejections into achievements.</h3>
    <p>The intentionally overbuilt Steam-style profile was funny in a group chat. It was not a record someone could inspect or update.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Website version</p>
    <h3>Each “no” became a badge with a receipt.</h3>
    <p>I removed the generic achievement profile and kept only rejection events. Opening a badge now shows its date, decision stage, and a short reflection.</p>
  </li>
  <li class="project-story-beat">
    <p class="project-case-kicker">Counting rule</p>
    <h3>38 XP means four rejection events.</h3>
    <p>A badge can appear on several shelves, and the Double Rejection combo can connect CHI and UIST, but neither adds another event or another point.</p>
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
    <figcaption><strong>Origin source.</strong> A supplied 1672 × 941 static lab meme, added at <code>77b8efbca</code> on May 29. Its profile statistics are fictional joke copy.</figcaption>
  </figure>
  <figure
    class="project-case-media site-experiment-evidence-figure"
    data-evidence-kind="runtime-crop"
    data-evidence-archive-commit="dd801b99ca48ba75991a5fb296919f7f7eb0dbc0"
    data-evidence-archive-date="2026-07-22"
    data-evidence-capture-date="2026-07-22"
    data-evidence-artifact-size="670x502"
    data-evidence-theme="light"
    data-evidence-theme-mode="noon"
    data-evidence-state="highlights-chi-rejection-pinned-receipt-open"
    data-evidence-source-commit="dd801b99ca48ba75991a5fb296919f7f7eb0dbc0"
    data-evidence-source-viewport="700x1000"
    data-evidence-device-pixel-ratio="1"
    data-evidence-browser="Chromium 145.0.7632.6"
  >
    <img src="{{ '/assets/img/project_pics/wall-of-rejection/wall-of-rejection-dd801b99ca-700-noon-highlights-chi-open.png' | relative_url }}" alt="Noon-theme Wall of Rejection with Highlights selected, the CHI Rejection receipt pinned open, four source-event badges, one zero-XP combo badge, and 38 of 50 Failure XP" loading="lazy" width="670" height="502">
    <figcaption><strong>Current wall.</strong> A 670 × 502 Noon/light runtime crop from <code>dd801b99c</code> on July 22: Highlights selected, the CHI receipt pinned open, and 38 XP from four source events; the fifth badge is a zero-XP combo.</figcaption>
  </figure>
</section>

Each public rejection has one source event and one receipt; shelves and combo badges never create another event.

## How each no moves through the wall

The ledger contains two first-author paper rejections at 12 XP each, one grant rejection at 7 XP, and one fellowship rejection at 7 XP: <strong>38 XP from four events</strong>.

<ol class="project-storyboard" aria-label="Rejection event to non-additive combo">
  <li class="project-storyboard-step">
    <h3>Event</h3>
    <p>I add a selected decision once, with its public label, rejection type, XP value, and eligible badges.</p>
  </li>
  <li class="project-storyboard-step">
    <h3>Badge</h3>
    <p>The event becomes a control such as CHI Rejection. It can appear in Highlights, Papers, or CHI without becoming three events.</p>
  </li>
  <li class="project-storyboard-step">
    <h3>Receipt</h3>
    <p>Open the badge to see its date, decision stage, short reflection, and category tags.</p>
  </li>
  <li class="project-storyboard-step">
    <h3>Non-additive combo</h3>
    <p>Double Rejection connects the CHI and UIST pattern and contributes <strong>0 XP</strong>. The joke gets a combo; the ledger still has two decisions.</p>
  </li>
</ol>

<aside class="project-story-note project-story-note--privacy" aria-labelledby="wall-boundary-title">
  <p class="project-case-kicker">Publication boundary</p>
  <h2 id="wall-boundary-title">A selected public record</h2>
  <p>The wall contains four allowlisted rejection events with brief receipts. Accepted work remains in the bibliography. Rejected titles, drafts, collaborator notes, and future venues stay private.</p>
</aside>

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="wall-technical-summary">Technical provenance and exact ledger</summary>
  <div class="project-story-disclosure-body" aria-labelledby="wall-technical-summary">
    <ul>
      <li><strong>Event source:</strong> <code>_data/wall_of_rejection.yml</code> separates source events, display badges, receipts, shelves, and joke metrics so repeated presentation cannot inflate the count.</li>
      <li><strong>Current math:</strong> CHI 2026 12 + UIST 2026 12 + MSR AI and the New Future of Work CFP 7 + MSR Fellowship 7 = 38 XP. Combo and milestone badges add 0.</li>
      <li><strong>Origin image:</strong> 1672 × 941, SHA-256 <code>dc4d4e79d5d6444867dfc56b7d436a6439226208b2885a34d37cf22bcb4c4271</code>, archived at <code>77b8efbca</code> on May 29.</li>
      <li><strong>Runtime crop:</strong> 670 × 502 Noon/light Highlights state with the CHI receipt pinned open, SHA-256 <code>44605d2f71e9a771c390eef6986d35952dd8c11df933a3c4ccc6747b859941e0</code>, captured from <code>dd801b99c</code> at a 700 × 1000 CSS-pixel viewport in Chromium 145.0.7632.6 on July 22.</li>
      <li><strong>Reading order:</strong> the wall remains secondary to the accepted-paper list; changing shelves reorganizes badges but never changes the event ledger or XP.</li>
    </ul>
    <ol class="site-experiment-ledger" aria-label="Wall of Rejection iteration record">
      <li><time datetime="2026-05-29">May 29</time><code>910f3c7f2</code><span>Replaced a generic review-achievement panel with rejection-only badges, receipts, and the first XP joke.</span></li>
      <li><time datetime="2026-05-29">May 29</time><code>77b8efbca</code><span>Restored the supplied lab meme as the real origin evidence instead of keeping a substitute.</span></li>
      <li><time datetime="2026-06-15">Jun 15</time><code>6ab847bcd</code><span>Separated source events from reusable badges, added grant and fellowship records, and made combo and milestone badges worth 0 XP.</span></li>
      <li><time datetime="2026-06-15">Jun 15</time><code>1dad10b5b</code><span>Added the rejection timeline and aligned the ledger with CV evidence while keeping accepted work out of the count.</span></li>
      <li><time datetime="2026-06-16">Jun 16</time><code>f51ff4f16</code><span>Quieted the evening hierarchy so the rejection wall stayed secondary to the papers.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>c23d42e9d</code><span>Archived the 670 × 502 current wall state for the project card and case-study evidence.</span></li>
      <li><time datetime="2026-07-22">Jul 22</time><code>dd801b99c</code><span>Recaptured the same current-wall story state with its source commit, viewport, browser, theme mode, and pinned interaction recorded.</span></li>
    </ol>
  </div>
</details>

<aside class="site-experiment-reproduce" aria-labelledby="wall-reproduce-title">
  <p class="project-case-kicker">Reproduce the pattern</p>
  <h2 id="wall-reproduce-title">Count the events before drawing the badges.</h2>
  <p>The guide separates events, badges, shelves, receipts, and joke metrics so the interface cannot inflate the underlying count.</p>
  <a href="{{ '/assets/downloads/site-experiments/wall-of-rejection-reproduction.md' | relative_url }}" download>Download the coding-agent brief</a>
</aside>

## Credits and the next joke

The wall nods to [Bradley Voytek’s failure-CV tradition](https://voyteklab.com/members), Sirui’s own post-UIST badge meme, and the strange optimism of the [Spooder-Man trailer](https://youtu.be/f_Pcu6wTzoA?si=2FKEbhC8hkqildqC). Those references shaped the honesty and tone, not the final interface skin.

The wall carries the evidence ledger. [HCI Spooder-Man]({{ '/projects/hci-spooder-man/' | relative_url }}) follows what happened when the double rejection became a character, a trailer-shaped joke, and a remix kit.
