---
layout: page
title: "sirui's secrets"
description: A tiny locked corner.
permalink: /blog/2026/sirui-research-thoughts/
sitemap: false
search: false
secret_globe: true
---

<div
  id="sirui-private-note"
  class="sirui-private-note"
  data-salt="iJoDMgLewA59OFlKJNkqyA=="
  data-iv="l6gF7cRta+KJfOKq"
>
  <p id="sirui-private-message" class="sirui-private-message" aria-live="polite">
    checking access...
  </p>

  <section id="sirui-crack-map" class="sirui-crack-map" hidden aria-labelledby="sirui-map-title">
    <div class="sirui-map-shell">
      <div class="sirui-map-topline">
        <div class="sirui-console-status" aria-live="polite">
          <span class="sirui-status-pill">ACCESS GRANTED</span>
          <span id="sirui-status-place">where-ish pending</span>
          <span id="sirui-status-time">time pending</span>
          <span id="sirui-status-count">count pending</span>
        </div>
        <h2 id="sirui-map-title">I see you.</h2>
        <p class="sirui-map-note">
          Browser-exposed details only. Location is where-ish, inferred from
          timezone, not raw IP.
        </p>
      </div>

      <div class="sirui-map-stage">
        <div
          id="sirui-globe"
          class="sirui-globe-canvas"
          role="img"
          aria-describedby="sirui-globe-status"
          aria-label="3D where-ish visitor globe"
        ></div>

        <p id="sirui-globe-status" class="sr-only" aria-live="polite">
          Waiting for the where-ish signal.
        </p>

        <div id="sirui-map-fallback" class="sirui-map-fallback" hidden>
          <svg
            class="sirui-world-map"
            viewBox="0 0 1000 520"
            role="img"
            aria-labelledby="sirui-world-title sirui-world-desc"
          >
            <title id="sirui-world-title">where-ish visitor map</title>
            <desc id="sirui-world-desc">
              A timezone-based map showing this browser's local unlock history.
            </desc>
            <defs>
              <pattern id="sirui-map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50"></path>
              </pattern>
            </defs>
            <rect class="sirui-map-bg" width="1000" height="520" rx="8"></rect>
            <rect class="sirui-map-grid-fill" width="1000" height="520" rx="8"></rect>
            <g class="sirui-map-longitudes" aria-hidden="true">
              <line x1="125" y1="26" x2="125" y2="494"></line>
              <line x1="250" y1="26" x2="250" y2="494"></line>
              <line x1="375" y1="26" x2="375" y2="494"></line>
              <line x1="500" y1="26" x2="500" y2="494"></line>
              <line x1="625" y1="26" x2="625" y2="494"></line>
              <line x1="750" y1="26" x2="750" y2="494"></line>
              <line x1="875" y1="26" x2="875" y2="494"></line>
            </g>
            <g class="sirui-map-latitudes" aria-hidden="true">
              <line x1="28" y1="130" x2="972" y2="130"></line>
              <line x1="28" y1="260" x2="972" y2="260"></line>
              <line x1="28" y1="390" x2="972" y2="390"></line>
            </g>
            <path
              class="sirui-map-land"
              d="M142 130 211 98 284 116 304 170 252 210 208 186 166 228 111 202 92 158z"
            ></path>
            <path
              class="sirui-map-land"
              d="M258 246 316 280 344 358 304 444 254 416 235 344 203 306z"
            ></path>
            <path
              class="sirui-map-land"
              d="M455 118 552 91 632 118 704 105 809 151 890 178 856 236 752 220 694 250 615 222 542 239 477 205z"
            ></path>
            <path
              class="sirui-map-land"
              d="M511 247 590 236 642 283 627 370 572 436 528 385 493 315z"
            ></path>
            <path class="sirui-map-land" d="M778 337 842 328 887 374 860 425 790 407 756 365z"></path>
            <g id="sirui-map-markers"></g>
          </svg>
        </div>

        <div class="sirui-map-scanline" aria-hidden="true"></div>

        <div class="sirui-sun-hud" aria-live="polite">
          <span>sun track</span>
          <span id="sirui-sun-utc">UTC --</span>
          <span id="sirui-sun-point">subsolar --</span>
        </div>
      </div>

      <div class="sirui-map-dock">
        <div class="sirui-map-readout" aria-live="polite">
          <span class="sirui-readout-label">where-ish</span>
          <h3 id="sirui-map-place">signal pending</h3>
          <p id="sirui-map-timezone">timezone pending</p>
          <dl>
            <div>
              <dt>visit time</dt>
              <dd id="sirui-map-time">--</dd>
            </div>
            <div>
              <dt>this browser</dt>
              <dd id="sirui-map-count">--</dd>
            </div>
          </dl>
        </div>

        <aside id="sirui-marker-card" class="sirui-marker-card" hidden>
          <p class="sirui-marker-kicker">marker details</p>
          <h3 id="sirui-marker-title">visitor</h3>
          <dl id="sirui-marker-facts"></dl>
        </aside>
      </div>

      <p class="sirui-map-footnote">
        GA4 gets aggregate country/city distribution from its normal geo
        reporting; this page does not collect or display raw IP addresses.
      </p>
    </div>

  </section>

  <section id="sirui-secret-note-wrap" class="sirui-secret-note" hidden aria-label="decrypted note">
    <div id="sirui-secret-copy" class="sirui-secret-copy"></div>
  </section>

  <script type="text/plain" id="sirui-private-payload">
    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
  </script>
</div>

<style>
  .sirui-private-note {
    max-width: 68rem;
  }

  .sirui-private-message {
    min-height: 1.5rem;
  }

  .sirui-private-message.is-unlocked {
    color: var(--global-text-color-light);
  }

  .sirui-private-message.sr-only {
    border: 0;
    clip: rect(0, 0, 0, 0);
    height: 1px;
    margin: -1px;
    min-height: 0;
    overflow: hidden;
    padding: 0;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  .sirui-crack-map[hidden],
  .sirui-secret-note[hidden] {
    display: none;
  }

  .sirui-crack-map {
    margin-top: 1.25rem;
  }

  .sirui-map-shell {
    --sirui-console-bg: #10130f;
    --sirui-console-panel: rgba(246, 252, 241, 0.08);
    --sirui-console-border: rgba(190, 244, 155, 0.24);
    --sirui-console-cyan: #70d8ff;
    --sirui-console-grid: rgba(142, 234, 98, 0.13);
    --sirui-console-land: rgba(142, 234, 98, 0.22);
    --sirui-console-accent: #8eea62;
    --sirui-console-hot: #ff4f9a;
    --sirui-console-text: #f4f8ef;
    --sirui-console-muted: #bdcbb5;
    --sirui-night-sky: url("{{ site.third_party_libraries.three-globe.url.night_sky }}");
    background:
      radial-gradient(circle at 82% 10%, rgba(255, 184, 86, 0.08), transparent 22%),
      radial-gradient(circle at 78% 14%, rgba(255, 79, 154, 0.12), transparent 24%),
      linear-gradient(135deg, #10130f 0%, #171a13 55%, #151412 100%);
    border: 1px solid var(--sirui-console-border);
    border-radius: 0.5rem;
    box-shadow: 0 1rem 2.4rem rgba(0, 0, 0, 0.22);
    color: var(--sirui-console-text);
    overflow: hidden;
    padding: clamp(1rem, 2vw, 1.35rem);
  }

  .sirui-map-topline {
    display: grid;
    gap: 0.45rem;
    max-width: none;
  }

  .sirui-console-status {
    align-items: center;
    color: var(--sirui-console-muted);
    display: flex;
    flex-wrap: wrap;
    font-size: 0.78rem;
    gap: 0.38rem 0.55rem;
    line-height: 1.35;
  }

  .sirui-console-status span:not(.sirui-status-pill) {
    align-items: center;
    color: #d9e7d0;
    display: inline-flex;
    gap: 0.55rem;
    font-weight: 600;
  }

  .sirui-console-status span:not(.sirui-status-pill)::before {
    background: rgba(244, 248, 239, 0.36);
    border-radius: 50%;
    content: "";
    display: inline-block;
    height: 0.22rem;
    width: 0.22rem;
  }

  .sirui-status-pill {
    background: rgba(142, 234, 98, 0.12);
    border: 1px solid rgba(142, 234, 98, 0.32);
    border-radius: 999px;
    color: var(--sirui-console-accent);
    font-weight: 800;
    padding: 0.16rem 0.45rem;
  }

  .sirui-readout-label,
  .sirui-marker-kicker {
    color: var(--sirui-console-accent);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0;
    margin: 0 0 0.35rem;
    text-transform: uppercase;
  }

  .sirui-map-topline h2 {
    color: var(--sirui-console-text);
    font-size: 3.25rem;
    line-height: 1;
    margin: 0;
  }

  .sirui-map-note,
  .sirui-map-footnote {
    color: var(--sirui-console-muted);
    line-height: 1.55;
    margin-bottom: 0;
  }

  .sirui-map-note {
    font-size: 0.86rem;
    margin-top: 0;
  }

  .sirui-map-footnote {
    font-size: 0.8rem;
    margin-top: 0.9rem;
  }

  .sirui-map-stage {
    isolation: isolate;
    margin-top: 0.8rem;
    position: relative;
  }

  .sirui-globe-canvas,
  .sirui-map-fallback {
    background:
      radial-gradient(circle at 52% 44%, rgba(112, 216, 255, 0.16), transparent 26rem),
      radial-gradient(circle at 78% 18%, rgba(255, 184, 86, 0.13), transparent 17rem),
      linear-gradient(rgba(5, 8, 6, 0.42), rgba(5, 8, 6, 0.78)),
      var(--sirui-night-sky) center / cover,
      #050806;
    border: 1px solid rgba(244, 248, 239, 0.16);
    border-radius: 0.5rem;
    min-height: 25rem;
    overflow: hidden;
    position: relative;
  }

  .sirui-globe-canvas {
    height: clamp(28rem, 56vh, 38rem);
  }

  .sirui-globe-canvas canvas {
    display: block;
  }

  .sirui-globe-canvas::after,
  .sirui-map-fallback::after {
    background:
      linear-gradient(rgba(244, 248, 239, 0.018) 50%, transparent 50%),
      linear-gradient(90deg, rgba(255, 255, 255, 0.026), transparent 12%, transparent 88%, rgba(255, 255, 255, 0.026));
    background-size:
      100% 4px,
      100% 100%;
    content: "";
    inset: 0;
    pointer-events: none;
    position: absolute;
    z-index: 2;
  }

  .sirui-globe-canvas.is-fallback {
    display: none;
  }

  .sirui-map-fallback[hidden] {
    display: none;
  }

  .sirui-world-map {
    display: block;
    height: auto;
    width: 100%;
  }

  .sirui-world-map #sirui-map-grid path {
    fill: none;
    stroke: var(--sirui-console-grid);
    stroke-width: 1;
  }

  .sirui-map-bg {
    fill: var(--sirui-console-bg);
    stroke: rgba(244, 248, 239, 0.16);
    stroke-width: 1.5;
  }

  .sirui-map-grid-fill {
    fill: url("#sirui-map-grid");
    opacity: 0.9;
  }

  .sirui-map-longitudes line,
  .sirui-map-latitudes line {
    stroke: rgba(244, 248, 239, 0.08);
    stroke-width: 1;
  }

  .sirui-map-land {
    fill: var(--sirui-console-land);
    opacity: 0.9;
    stroke: rgba(244, 248, 239, 0.26);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .sirui-map-scanline {
    animation: sirui-map-scan 4.8s linear infinite;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(142, 234, 98, 0.12) 49%,
      transparent 100%
    );
    height: 3.5rem;
    inset: -3.5rem 0 auto;
    pointer-events: none;
    position: absolute;
  }

  .sirui-sun-hud {
    align-items: center;
    background: rgba(5, 8, 6, 0.62);
    border: 1px solid rgba(255, 184, 86, 0.28);
    border-radius: 999px;
    bottom: 0.75rem;
    color: var(--sirui-console-muted);
    display: flex;
    flex-wrap: wrap;
    font-size: 0.72rem;
    gap: 0.3rem 0.65rem;
    left: 0.75rem;
    line-height: 1.35;
    max-width: calc(100% - 1.5rem);
    padding: 0.4rem 0.6rem;
    pointer-events: none;
    position: absolute;
    z-index: 3;
  }

  .sirui-sun-hud span:first-child {
    color: #ffb856;
    font-weight: 800;
    text-transform: uppercase;
  }

  .sirui-sun-hud span:not(:first-child) {
    color: #d9e7d0;
    font-weight: 600;
  }

  @keyframes sirui-map-scan {
    0% {
      transform: translateY(0);
    }

    100% {
      transform: translateY(44rem);
    }
  }

  .sirui-globe-marker {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--sirui-console-text);
    cursor: pointer;
    display: flex;
    gap: 0.38rem;
    letter-spacing: 0;
    padding: 0;
    pointer-events: auto;
    position: relative;
    transform: translate(-50%, -50%);
    white-space: nowrap;
  }

  .sirui-globe-marker:focus-visible {
    outline: 2px solid var(--sirui-console-cyan);
    outline-offset: 4px;
  }

  .sirui-globe-marker-dot {
    background: var(--sirui-console-accent);
    border: 2px solid var(--sirui-console-bg);
    border-radius: 50%;
    box-shadow:
      0 0 0 0.35rem rgba(142, 234, 98, 0.16),
      0 0 1.2rem rgba(112, 216, 255, 0.55);
    display: block;
    height: 0.72rem;
    position: relative;
    width: 0.72rem;
  }

  .sirui-globe-marker.is-active .sirui-globe-marker-dot,
  .sirui-globe-marker:hover .sirui-globe-marker-dot,
  .sirui-globe-marker:focus-visible .sirui-globe-marker-dot {
    background: var(--sirui-console-hot);
    box-shadow:
      0 0 0 0.45rem rgba(255, 79, 154, 0.18),
      0 0 1.35rem rgba(255, 79, 154, 0.7);
  }

  .sirui-globe-marker.is-current .sirui-globe-marker-dot::after {
    animation: sirui-marker-pulse 2.2s ease-out infinite;
    border: 2px solid var(--sirui-console-hot);
    border-radius: 50%;
    content: "";
    inset: -0.5rem;
    opacity: 0.8;
    position: absolute;
  }

  .sirui-globe-marker-label {
    background: rgba(5, 8, 6, 0.68);
    border: 1px solid rgba(244, 248, 239, 0.16);
    border-radius: 999px;
    color: var(--sirui-console-text);
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1;
    padding: 0.28rem 0.45rem;
    transition:
      opacity 160ms ease,
      transform 160ms ease;
  }

  .sirui-globe-marker-tooltip {
    background: rgba(5, 8, 6, 0.86);
    border: 1px solid rgba(244, 248, 239, 0.18);
    border-radius: 0.35rem;
    bottom: calc(100% + 0.45rem);
    color: var(--sirui-console-muted);
    font-size: 0.7rem;
    left: 50%;
    line-height: 1.35;
    max-width: 15rem;
    opacity: 0;
    overflow-wrap: anywhere;
    padding: 0.35rem 0.45rem;
    pointer-events: none;
    position: absolute;
    transform: translate(-50%, 0.25rem);
    transition:
      opacity 140ms ease,
      transform 140ms ease;
    white-space: normal;
    width: max-content;
  }

  .sirui-globe-marker:hover .sirui-globe-marker-tooltip,
  .sirui-globe-marker:focus-visible .sirui-globe-marker-tooltip {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  .sirui-sun-marker {
    align-items: center;
    background: rgba(255, 184, 86, 0.16);
    border: 1px solid rgba(255, 184, 86, 0.55);
    border-radius: 999px;
    box-shadow:
      0 0 1.4rem rgba(255, 184, 86, 0.42),
      inset 0 0 0.75rem rgba(255, 184, 86, 0.2);
    color: #ffcc7d;
    display: inline-flex;
    font-size: 0.68rem;
    font-weight: 800;
    gap: 0.28rem;
    padding: 0.18rem 0.4rem;
    pointer-events: none;
    transform: translate(-50%, -50%);
    white-space: nowrap;
  }

  .sirui-sun-marker::before {
    background: #ffb856;
    border-radius: 50%;
    box-shadow: 0 0 1rem rgba(255, 184, 86, 0.95);
    content: "";
    height: 0.45rem;
    width: 0.45rem;
  }

  .sirui-map-stage.is-zoom-far .sirui-globe-marker:not(.is-current) .sirui-globe-marker-label,
  .sirui-map-stage.is-zoom-far .sirui-globe-marker:not(.is-current) {
    opacity: 0.58;
  }

  .sirui-map-stage.is-zoom-far .sirui-globe-marker:not(.is-current) .sirui-globe-marker-label,
  .sirui-map-stage.is-zoom-mid .sirui-globe-marker:not(.is-active) .sirui-globe-marker-count {
    opacity: 0;
    transform: translateY(0.2rem);
  }

  .sirui-globe-marker-count {
    color: var(--sirui-console-cyan);
  }

  .sirui-map-marker-group {
    cursor: pointer;
    outline: none;
  }

  .sirui-map-marker-hit {
    fill: transparent;
  }

  .sirui-map-marker-pulse {
    animation: sirui-marker-pulse 2.2s ease-out infinite;
    fill: none;
    stroke: var(--sirui-console-hot);
    stroke-width: 3;
    transform-box: fill-box;
    transform-origin: center;
  }

  .sirui-map-marker-dot {
    fill: var(--sirui-console-accent);
    stroke: var(--sirui-console-bg);
    stroke-width: 4;
    transition:
      fill 160ms ease,
      r 160ms ease;
  }

  .sirui-map-marker-label {
    fill: var(--sirui-console-text);
    font-size: 20px;
    font-weight: 700;
    paint-order: stroke;
    pointer-events: none;
    stroke: var(--sirui-console-bg);
    stroke-linejoin: round;
    stroke-width: 5px;
  }

  .sirui-map-marker-group:hover .sirui-map-marker-dot,
  .sirui-map-marker-group:focus .sirui-map-marker-dot,
  .sirui-map-marker-group.is-active .sirui-map-marker-dot {
    fill: var(--sirui-console-hot);
  }

  .sirui-map-marker-group:focus-visible .sirui-map-marker-dot {
    outline: 2px solid var(--sirui-console-text);
  }

  @keyframes sirui-marker-pulse {
    0% {
      opacity: 0.95;
      transform: scale(0.74);
    }

    100% {
      opacity: 0;
      transform: scale(1.85);
    }
  }

  .sirui-map-dock {
    align-items: start;
    display: grid;
    gap: 0.75rem;
    grid-template-columns: minmax(17rem, 0.8fr) minmax(0, 1.2fr);
    margin-top: 0.75rem;
  }

  .sirui-map-readout,
  .sirui-marker-card {
    background: rgba(16, 19, 15, 0.82);
    border: 1px solid var(--sirui-console-border);
    border-radius: 0.5rem;
    box-shadow: 0 0.7rem 1.8rem rgba(0, 0, 0, 0.28);
    overflow-wrap: anywhere;
    padding: 0.9rem;
    position: relative;
  }

  .sirui-map-readout h3,
  .sirui-marker-card h3 {
    color: var(--sirui-console-text);
    font-size: 1.15rem;
    line-height: 1.2;
    margin: 0;
  }

  .sirui-map-readout p {
    color: var(--sirui-console-muted);
    font-size: 0.82rem;
    margin: 0.25rem 0 0.75rem;
  }

  .sirui-map-readout dl,
  .sirui-marker-card dl {
    display: grid;
    gap: 0.45rem;
    margin: 0;
  }

  .sirui-map-readout dl {
    grid-template-columns: 1fr;
  }

  .sirui-map-readout dl div,
  .sirui-marker-card div {
    border-top: 1px solid rgba(244, 248, 239, 0.12);
    padding-top: 0.45rem;
  }

  .sirui-map-readout dt,
  .sirui-marker-card dt {
    color: var(--sirui-console-muted);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0;
    margin: 0;
    text-transform: uppercase;
  }

  .sirui-map-readout dd,
  .sirui-marker-card dd {
    color: var(--sirui-console-text);
    margin: 0.1rem 0 0;
  }

  .sirui-marker-card {
    max-height: min(22rem, 46vh);
    overflow: auto;
  }

  .sirui-marker-card[hidden] {
    display: none;
  }

  .sirui-secret-note {
    border-top: 1px solid var(--global-divider-color);
    margin-top: 1.5rem;
    padding-top: 1rem;
  }

  .sirui-secret-copy {
    max-width: 48rem;
  }

  .sirui-secret-copy h2 {
    margin-bottom: 0.75rem;
  }

  .sirui-secret-copy h3 {
    font-size: 1.35rem;
    margin-top: 1.5rem;
  }

  .sirui-secret-copy p {
    line-height: 1.65;
  }

  .sirui-secret-copy ol {
    padding-left: 1.35rem;
  }

  .sirui-secret-copy li {
    line-height: 1.55;
    margin-bottom: 0.55rem;
  }

  .sirui-secret-copy blockquote {
    border-left: 0.25rem solid var(--global-theme-color);
    color: var(--global-text-color);
    margin: 1rem 0;
    padding: 0.35rem 0 0.35rem 1rem;
  }

  .sirui-secret-copy blockquote p {
    margin-bottom: 0;
  }

  @media (max-width: 720px) {
    .sirui-map-shell {
      padding: 0.85rem;
    }

    .sirui-map-topline h2 {
      font-size: 2.45rem;
    }

    .sirui-globe-canvas {
      height: clamp(25rem, 68vh, 34rem);
    }

    .sirui-map-dock {
      grid-template-columns: 1fr;
    }

    .sirui-map-scanline {
      display: none;
    }

    .sirui-map-marker-label {
      font-size: 26px;
    }
  }

  @media (max-width: 480px) {
    .sirui-map-topline h2 {
      font-size: 2.15rem;
    }

    .sirui-globe-canvas {
      height: 26rem;
    }

    .sirui-map-note {
      font-size: 0.86rem;
    }

    .sirui-map-shell {
      margin-left: -0.25rem;
      margin-right: -0.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sirui-map-scanline,
    .sirui-map-marker-pulse,
    .sirui-globe-marker.is-current .sirui-globe-marker-dot::after,
    .sirui-globe-marker-tooltip {
      animation: none;
      transition: none;
    }

    .sirui-map-marker-pulse {
      opacity: 0.35;
    }
  }
</style>

<script>
  (() => {
    const container = document.getElementById("sirui-private-note");
    const message = document.getElementById("sirui-private-message");
    const payload = document.getElementById("sirui-private-payload");
    const secretCopy = document.getElementById("sirui-secret-copy");
    const secretNote = document.getElementById("sirui-secret-note-wrap");
    const map = document.getElementById("sirui-crack-map");
    const mapStage = map?.querySelector(".sirui-map-stage");
    const globeElement = document.getElementById("sirui-globe");
    const globeStatus = document.getElementById("sirui-globe-status");
    const mapFallback = document.getElementById("sirui-map-fallback");
    const markerLayer = document.getElementById("sirui-map-markers");
    const markerCard = document.getElementById("sirui-marker-card");
    const markerTitle = document.getElementById("sirui-marker-title");
    const markerFacts = document.getElementById("sirui-marker-facts");
    const mapPlace = document.getElementById("sirui-map-place");
    const mapTimezone = document.getElementById("sirui-map-timezone");
    const mapTime = document.getElementById("sirui-map-time");
    const mapCount = document.getElementById("sirui-map-count");
    const statusPlace = document.getElementById("sirui-status-place");
    const statusTime = document.getElementById("sirui-status-time");
    const statusCount = document.getElementById("sirui-status-count");
    const sunUtc = document.getElementById("sirui-sun-utc");
    const sunPoint = document.getElementById("sirui-sun-point");

    const logKey = "siruiResearchThoughtsCrackLog";
    const browserIdKey = "siruiResearchThoughtsBrowserId";
    const passwordKey = "siruiResearchThoughtsPassword";
    const readoutVersion = "globe_v1";
    const svgNamespace = "http://www.w3.org/2000/svg";
    const globeTextureUrl = "{{ site.third_party_libraries.three-globe.url.earth_blue_marble }}";
    const globeFallbackTextureUrl = "{{ site.third_party_libraries.three-globe.url.earth_day }}";
    const globeBumpUrl = "{{ site.third_party_libraries.three-globe.url.earth_topology }}";
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let globeInstance = null;
    let globeResizeObserver = null;
    let sunTimer = null;
    let activeMarkerId = "";

    const b64ToBytes = (value) =>
      Uint8Array.from(atob(value.replace(/\s/g, "")), (char) =>
        char.charCodeAt(0),
      );

    const deriveKey = async (password, salt) => {
      const material = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveKey"],
      );

      return crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt,
          iterations: 250000,
          hash: "SHA-256",
        },
        material,
        {
          name: "AES-GCM",
          length: 256,
        },
        false,
        ["decrypt"],
      );
    };

    const timezonePlaces = {
      "America/Anchorage": {
        city: "Anchorage",
        country: "United States",
        coordinates: [-149.9003, 61.2181],
      },
      "America/Chicago": {
        city: "Chicago",
        country: "United States",
        coordinates: [-87.6298, 41.8781],
      },
      "America/Denver": {
        city: "Denver",
        country: "United States",
        coordinates: [-104.9903, 39.7392],
      },
      "America/Detroit": {
        city: "Detroit",
        country: "United States",
        coordinates: [-83.0458, 42.3314],
      },
      "America/Halifax": {
        city: "Halifax",
        country: "Canada",
        coordinates: [-63.5752, 44.6488],
      },
      "America/Honolulu": {
        city: "Honolulu",
        country: "United States",
        coordinates: [-157.8583, 21.3069],
      },
      "America/Los_Angeles": {
        city: "Los Angeles",
        country: "United States",
        coordinates: [-118.2437, 34.0522],
      },
      "America/Mexico_City": {
        city: "Mexico City",
        country: "Mexico",
        coordinates: [-99.1332, 19.4326],
      },
      "America/New_York": {
        city: "New York",
        country: "United States",
        coordinates: [-74.006, 40.7128],
      },
      "America/Phoenix": {
        city: "Phoenix",
        country: "United States",
        coordinates: [-112.074, 33.4484],
      },
      "America/Sao_Paulo": {
        city: "Sao Paulo",
        country: "Brazil",
        coordinates: [-46.6333, -23.5505],
      },
      "America/Toronto": {
        city: "Toronto",
        country: "Canada",
        coordinates: [-79.3832, 43.6532],
      },
      "America/Vancouver": {
        city: "Vancouver",
        country: "Canada",
        coordinates: [-123.1207, 49.2827],
      },
      "Asia/Bangkok": {
        city: "Bangkok",
        country: "Thailand",
        coordinates: [100.5018, 13.7563],
      },
      "Asia/Dubai": {
        city: "Dubai",
        country: "United Arab Emirates",
        coordinates: [55.2708, 25.2048],
      },
      "Asia/Hong_Kong": {
        city: "Hong Kong",
        country: "Hong Kong",
        coordinates: [114.1694, 22.3193],
      },
      "Asia/Jakarta": {
        city: "Jakarta",
        country: "Indonesia",
        coordinates: [106.8456, -6.2088],
      },
      "Asia/Kolkata": {
        city: "Kolkata",
        country: "India",
        coordinates: [88.3639, 22.5726],
      },
      "Asia/Manila": {
        city: "Manila",
        country: "Philippines",
        coordinates: [120.9842, 14.5995],
      },
      "Asia/Seoul": {
        city: "Seoul",
        country: "South Korea",
        coordinates: [126.978, 37.5665],
      },
      "Asia/Shanghai": {
        city: "Shanghai",
        country: "China",
        coordinates: [121.4737, 31.2304],
      },
      "Asia/Singapore": {
        city: "Singapore",
        country: "Singapore",
        coordinates: [103.8198, 1.3521],
      },
      "Asia/Taipei": {
        city: "Taipei",
        country: "Taiwan",
        coordinates: [121.5654, 25.033],
      },
      "Asia/Tokyo": {
        city: "Tokyo",
        country: "Japan",
        coordinates: [139.6503, 35.6762],
      },
      "Australia/Melbourne": {
        city: "Melbourne",
        country: "Australia",
        coordinates: [144.9631, -37.8136],
      },
      "Australia/Sydney": {
        city: "Sydney",
        country: "Australia",
        coordinates: [151.2093, -33.8688],
      },
      "Europe/Amsterdam": {
        city: "Amsterdam",
        country: "Netherlands",
        coordinates: [4.9041, 52.3676],
      },
      "Europe/Berlin": {
        city: "Berlin",
        country: "Germany",
        coordinates: [13.405, 52.52],
      },
      "Europe/London": {
        city: "London",
        country: "United Kingdom",
        coordinates: [-0.1276, 51.5072],
      },
      "Europe/Madrid": {
        city: "Madrid",
        country: "Spain",
        coordinates: [-3.7038, 40.4168],
      },
      "Europe/Paris": {
        city: "Paris",
        country: "France",
        coordinates: [2.3522, 48.8566],
      },
      "Europe/Rome": {
        city: "Rome",
        country: "Italy",
        coordinates: [12.4964, 41.9028],
      },
      "Europe/Stockholm": {
        city: "Stockholm",
        country: "Sweden",
        coordinates: [18.0686, 59.3293],
      },
      "Europe/Zurich": {
        city: "Zurich",
        country: "Switzerland",
        coordinates: [8.5417, 47.3769],
      },
      "Pacific/Auckland": {
        city: "Auckland",
        country: "New Zealand",
        coordinates: [174.7633, -36.8485],
      },
    };

    const getPlace = (timezone) => {
      const place = timezonePlaces[timezone];

      if (place) {
        const [lng, lat] = place.coordinates;

        return {
          ...place,
          lat,
          lng,
          source: "timezone match",
          timezone,
        };
      }

      return null;
    };

    const projectPoint = (entry) => {
      const longitude = Number(entry.lng);
      const latitude = Number(entry.lat);

      return [((longitude + 180) / 360) * 1000, ((90 - latitude) / 180) * 520];
    };

    const safeLocalGet = (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    };

    const safeLocalSet = (key, value) => {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    };

    const safeSessionGet = (key) => {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    };

    const safeSessionRemove = (key) => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Ignore blocked storage.
      }
    };

    const getLog = () => {
      try {
        return JSON.parse(safeLocalGet(logKey)) || [];
      } catch {
        return [];
      }
    };

    const saveLog = (entries) => {
      safeLocalSet(logKey, JSON.stringify(entries));
    };

    const hasValue = (value) =>
      value !== undefined && value !== null && String(value).trim() !== "";

    const getBrowserId = () => {
      const stored = safeLocalGet(browserIdKey);
      if (stored) return stored;

      const browserId =
        crypto.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      safeLocalSet(browserIdKey, browserId);
      return browserId;
    };

    const getBrowserSummary = () => {
      try {
        if (navigator.userAgentData?.brands?.length) {
          return navigator.userAgentData.brands
            .map((brand) => `${brand.brand} ${brand.version}`)
            .join(", ");
        }

        const ua = navigator.userAgent;
        if (/Edg\//.test(ua)) return "Microsoft Edge";
        if (/Chrome\//.test(ua)) return "Chrome";
        if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
        if (/Firefox\//.test(ua)) return "Firefox";
      } catch {
        return "";
      }

      return "";
    };

    const readSafely = (reader) => {
      try {
        const value = reader();
        return value === undefined || value === null ? "" : String(value).trim();
      } catch {
        return "";
      }
    };

    const collectVisitorMeta = () => {
      const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;
      const now = new Date();
      const timezone = readSafely(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      const localTime = readSafely(() =>
        new Intl.DateTimeFormat(undefined, {
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          month: "short",
          timeZoneName: "short",
          year: "numeric",
        }).format(now),
      );
      const connectionSummary = connection
        ? [connection.effectiveType, connection.downlink ? `${connection.downlink} Mbps-ish` : ""]
            .filter(Boolean)
            .join(", ")
        : "";

      return {
        browser: getBrowserSummary(),
        connection: connectionSummary,
        cookies: navigator.cookieEnabled ? "enabled" : "disabled",
        cores: readSafely(() => navigator.hardwareConcurrency),
        deviceMemory: readSafely(() =>
          navigator.deviceMemory ? `${navigator.deviceMemory} GB-ish` : "",
        ),
        doNotTrack: readSafely(
          () => navigator.doNotTrack || window.doNotTrack,
        ),
        language: readSafely(
          () => navigator.languages?.join(", ") || navigator.language,
        ),
        localHour: now.getHours(),
        localTime,
        platform: readSafely(
          () => navigator.userAgentData?.platform || navigator.platform,
        ),
        referrer: document.referrer,
        screen: readSafely(
          () => `${screen.width} x ${screen.height} @ ${window.devicePixelRatio || 1}x`,
        ),
        timezone,
        touchPoints: readSafely(() => navigator.maxTouchPoints),
        viewport: readSafely(() => `${window.innerWidth} x ${window.innerHeight}`),
      };
    };

    const sendUnlockAnalytics = (entry, meta) => {
      if (typeof window.gtag !== "function") return;

      try {
        const eventParams = {
          secret_id: "sirui_research_thoughts",
          unlock_method: "dog_password",
          unlock_timezone: entry.timezone || "unknown",
          unlock_count_for_browser: Number(entry.browserUnlockCount || entry.count) || 1,
          readout_version: readoutVersion,
        };

        if (Number.isFinite(meta.localHour)) {
          eventParams.unlock_local_hour = meta.localHour;
        }

        window.gtag("event", "secret_page_unlock", eventParams);
      } catch (error) {
        console.warn("secret page analytics failed", error);
      }
    };

    const placeSnapshot = (place) =>
      place
        ? {
            city: place.city,
            country: place.country,
            lat: place.lat,
            lng: place.lng,
            timezone: place.timezone,
          }
        : null;

    const recordUnlock = (meta) => {
      const now = new Date();
      const browserId = getBrowserId();
      const place = getPlace(meta.timezone);
      const entries = getLog();
      const id = `${browserId}|${meta.timezone || "unknown"}`;
      const existing = entries.find((entry) => entry.id === id);
      let activeEntry = existing;

      if (existing) {
        existing.browserId = existing.browserId || browserId;
        existing.label = "you";
        if (place) {
          existing.coordinateSource = place.source;
          existing.lat = place.lat;
          existing.lng = place.lng;
          existing.place = placeSnapshot(place);
        } else if (existing.coordinateSource !== "timezone match") {
          delete existing.lat;
          delete existing.lng;
          existing.coordinateSource = "";
          existing.place = null;
        }
        existing.count = (Number(existing.count) || 0) + 1;
        existing.lastLocalTime = meta.localTime;
        existing.lastIso = now.toISOString();
        existing.meta = meta;
      } else {
        activeEntry = {
          id,
          browserId,
          label: "you",
          timezone: meta.timezone,
          coordinateSource: place?.source || "",
          count: 1,
          firstLocalTime: meta.localTime,
          lastLocalTime: meta.localTime,
          lastIso: now.toISOString(),
          lat: place?.lat,
          lng: place?.lng,
          meta,
          place: placeSnapshot(place),
        };
        entries.push(activeEntry);
      }

      const browserUnlockCount = entries
        .filter((entry) => !entry.browserId || entry.browserId === browserId)
        .reduce((total, entry) => total + (Number(entry.count) || 0), 0);
      activeEntry.browserUnlockCount = browserUnlockCount;

      saveLog(entries);
      return { entries, activeEntry };
    };

    const formatUnlockCount = (count) => {
      const safeCount = Number(count) || 0;
      return safeCount === 1
        ? "1 successful unlock"
        : `${safeCount} successful unlocks`;
    };

    const normalizeEntry = (entry) => {
      const legacyCoordinates =
        entry.place?.coordinates || entry.coordinates || null;
      const storedPlace =
        Number.isFinite(Number(entry.place?.lat)) &&
        Number.isFinite(Number(entry.place?.lng))
          ? {
              ...entry.place,
              source: "timezone match",
            }
          : Array.isArray(legacyCoordinates)
            ? {
                city: entry.place?.city,
                country: entry.place?.country,
                lat: legacyCoordinates[1],
                lng: legacyCoordinates[0],
                source: "timezone match",
                timezone: entry.timezone,
              }
            : null;
      const place = storedPlace || getPlace(entry.timezone);

      if (place) {
        return {
          ...entry,
          coordinateSource: "timezone match",
          lat: place.lat,
          lng: place.lng,
          place: placeSnapshot(place),
        };
      }

      return {
        ...entry,
        coordinateSource: "",
        lat: null,
        lng: null,
        place: null,
      };
    };

    const whereLabel = (entry) => {
      if (entry?.place?.city && entry?.place?.country) {
        return `${entry.place.city}, ${entry.place.country}`;
      }

      if (entry?.timezone) {
        return `unmapped ${entry.timezone}`;
      }

      return "unknown signal";
    };

    const shortPlaceLabel = (entry) => {
      if (entry?.place?.city) return entry.place.city;
      if (!entry?.timezone) return "unknown";

      return entry.timezone.split("/").pop().replace(/_/g, " ");
    };

    const timezoneLabel = (entry) => {
      if (!entry?.timezone) return "timezone unavailable";

      return entry.coordinateSource
        ? `${entry.timezone} (${entry.coordinateSource})`
        : entry.timezone;
    };

    const setText = (element, value) => {
      if (element) element.textContent = hasValue(value) ? value : "--";
    };

    const createFactRow = (label, value) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value;
      row.append(term, detail);
      return row;
    };

    const detailsForEntry = (entry) => {
      const meta = entry.meta || {};
      return [
        ["where-ish", whereLabel(entry)],
        ["timezone", timezoneLabel(entry)],
        ["last visit", entry.lastLocalTime],
        ["first visit", entry.firstLocalTime],
        ["this browser", formatUnlockCount(entry.browserUnlockCount || entry.count)],
        ["this place", formatUnlockCount(entry.count)],
        ["browser", meta.browser],
        ["platform", meta.platform],
        ["language", meta.language],
        ["screen", meta.screen],
        ["viewport", meta.viewport],
        ["connection", meta.connection],
        ["CPU threads", meta.cores],
        ["memory hint", meta.deviceMemory],
        ["touch points", meta.touchPoints],
        ["cookies", meta.cookies],
        ["do not track", meta.doNotTrack],
        ["referrer", meta.referrer],
      ].filter(([, value]) => hasValue(value));
    };

    const renderReadout = (entry) => {
      setText(mapPlace, whereLabel(entry));
      setText(mapTimezone, timezoneLabel(entry));
      setText(mapTime, entry?.lastLocalTime);
      setText(mapCount, formatUnlockCount(entry?.browserUnlockCount || entry?.count));
      setText(statusPlace, whereLabel(entry));
      setText(statusTime, entry?.lastLocalTime);
      setText(
        statusCount,
        formatUnlockCount(entry?.browserUnlockCount || entry?.count),
      );
    };

    const setActiveMarker = (id) => {
      activeMarkerId = id || "";
      document
        .querySelectorAll(".sirui-map-marker-group, .sirui-globe-marker")
        .forEach((marker) => {
          marker.classList.toggle("is-active", marker.dataset.entryId === id);
          marker.classList.toggle("is-selected", marker.dataset.entryId === id);
        });
    };

    let detailsPinned = false;

    const previewMarker = (entry) => {
      if (!detailsPinned) setActiveMarker(entry.id);
    };

    const clearMarkerPreview = () => {
      if (!detailsPinned) setActiveMarker("");
    };

    const showMarkerDetails = (entry, { pinned = false } = {}) => {
      if (!markerCard || !markerTitle || !markerFacts) return;

      if (pinned) detailsPinned = true;
      setActiveMarker(entry.id);
      markerTitle.textContent = whereLabel(entry);
      markerFacts.replaceChildren(
        ...detailsForEntry(entry).map(([label, value]) =>
          createFactRow(label, value),
        ),
      );
      markerCard.hidden = false;
    };

    const hideMarkerDetails = () => {
      if (detailsPinned || !markerCard) return;

      markerCard.hidden = true;
      setActiveMarker("");
    };

    const clearPinnedDetails = () => {
      detailsPinned = false;
      if (markerCard) markerCard.hidden = true;
      setActiveMarker("");
    };

    const svgElement = (name, attributes = {}) => {
      const element = document.createElementNS(svgNamespace, name);
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      return element;
    };

    const renderMarker = (entry) => {
      const [x, y] = projectPoint(entry);
      const label = shortPlaceLabel(entry);
      const group = svgElement("g", {
        "aria-label": `details for ${whereLabel(entry)}`,
        class: "sirui-map-marker-group",
        role: "button",
        tabindex: "0",
      });
      group.dataset.entryId = entry.id;

      const title = svgElement("title");
      title.textContent = `${whereLabel(entry)} - ${entry.lastLocalTime} - ${formatUnlockCount(entry.count)}`;

      const hit = svgElement("circle", {
        class: "sirui-map-marker-hit",
        cx: x.toFixed(1),
        cy: y.toFixed(1),
        r: "28",
      });
      const pulse = svgElement("circle", {
        class: "sirui-map-marker-pulse",
        cx: x.toFixed(1),
        cy: y.toFixed(1),
        r: String(12 + Math.min(Number(entry.count) || 0, 7)),
      });
      const dot = svgElement("circle", {
        class: "sirui-map-marker-dot",
        cx: x.toFixed(1),
        cy: y.toFixed(1),
        r: String(7 + Math.min(Number(entry.count) || 0, 5)),
      });
      const text = svgElement("text", {
        class: "sirui-map-marker-label",
        x: (x + 14).toFixed(1),
        y: (y - 12).toFixed(1),
      });
      text.textContent = label;

      group.append(title, hit, pulse, dot, text);
      group.addEventListener("mouseenter", () => previewMarker(entry));
      group.addEventListener("mouseleave", clearMarkerPreview);
      group.addEventListener("focus", () => showMarkerDetails(entry));
      group.addEventListener("blur", hideMarkerDetails);
      group.addEventListener("click", (event) => {
        event.stopPropagation();
        showMarkerDetails(entry, { pinned: true });
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showMarkerDetails(entry, { pinned: true });
        }
      });

      return group;
    };

    const hasCoordinates = (entry) =>
      Number.isFinite(Number(entry?.lat)) && Number.isFinite(Number(entry?.lng));

    const setGlobeStatus = (value) => {
      if (globeStatus) globeStatus.textContent = value;
    };

    const hasWebGl = () => {
      try {
        const canvas = document.createElement("canvas");
        return Boolean(
          canvas.getContext("webgl2") ||
            canvas.getContext("webgl") ||
            canvas.getContext("experimental-webgl"),
        );
      } catch {
        return false;
      }
    };

    const waitForGlobe = () =>
      new Promise((resolve) => {
        if (typeof window.Globe === "function") {
          resolve(window.Globe);
          return;
        }

        const started = Date.now();
        const interval = window.setInterval(() => {
          if (typeof window.Globe === "function") {
            window.clearInterval(interval);
            resolve(window.Globe);
          } else if (Date.now() - started > 3000) {
            window.clearInterval(interval);
            resolve(null);
          }
        }, 60);
      });

    const normalizeLongitude = (longitude) =>
      ((((Number(longitude) || 0) + 540) % 360) + 360) % 360 - 180;

    const getSubsolarPoint = (date = new Date()) => {
      const year = date.getUTCFullYear();
      const dayStart = Date.UTC(year, 0, 0);
      const dayOfYear = Math.floor((date.getTime() - dayStart) / 86400000);
      const minutes =
        date.getUTCHours() * 60 +
        date.getUTCMinutes() +
        date.getUTCSeconds() / 60;
      const gamma =
        (2 * Math.PI) / 365 *
        (dayOfYear - 1 + (minutes / 60 - 12) / 24);
      const declination =
        0.006918 -
        0.399912 * Math.cos(gamma) +
        0.070257 * Math.sin(gamma) -
        0.006758 * Math.cos(2 * gamma) +
        0.000907 * Math.sin(2 * gamma) -
        0.002697 * Math.cos(3 * gamma) +
        0.00148 * Math.sin(3 * gamma);
      const equationOfTime =
        229.18 *
        (0.000075 +
          0.001868 * Math.cos(gamma) -
          0.032077 * Math.sin(gamma) -
          0.014615 * Math.cos(2 * gamma) -
          0.040849 * Math.sin(2 * gamma));

      return {
        lat: (declination * 180) / Math.PI,
        lng: normalizeLongitude(180 - (minutes + equationOfTime) / 4),
      };
    };

    const formatCoordinate = (value, positive, negative) => {
      const number = Number(value) || 0;
      return `${Math.abs(number).toFixed(1)}\u00b0${number >= 0 ? positive : negative}`;
    };

    const sunVector = ({ lat, lng }, radius = 420) => {
      const phi = ((90 - lat) * Math.PI) / 180;
      const theta = ((lng + 180) * Math.PI) / 180;

      return {
        x: -radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
      };
    };

    const makeSunEntry = (date = new Date()) => {
      const point = getSubsolarPoint(date);

      return {
        id: "sun-track",
        kind: "sun",
        lat: point.lat,
        lng: point.lng,
      };
    };

    const updateSunHud = (date, point) => {
      if (sunUtc) {
        sunUtc.textContent = `UTC ${date.toISOString().slice(11, 16)}`;
      }

      if (sunPoint) {
        sunPoint.textContent = `subsolar ${formatCoordinate(point.lat, "N", "S")}, ${formatCoordinate(point.lng, "E", "W")}`;
      }
    };

    const tuneGlobeRender = (globe) => {
      const renderer = globe.renderer?.();
      if (renderer?.setPixelRatio) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      }

      const camera = globe.camera?.();
      if (camera?.updateProjectionMatrix) {
        camera.fov = 45;
        camera.near = 0.1;
        camera.far = 2000;
        camera.updateProjectionMatrix();
      }

      const material = globe.globeMaterial?.();
      if (material) {
        material.bumpScale = 6;
        material.shininess = 18;
        material.needsUpdate = true;
      }

      const lights = globe.lights?.();
      if (Array.isArray(lights)) {
        lights.forEach((light) => {
          if (light.type === "AmbientLight") light.intensity = 0.34;
          if (light.type === "DirectionalLight") light.intensity = 1.32;
        });
      }
    };

    const updateSunlight = (globe, date = new Date()) => {
      const point = getSubsolarPoint(date);
      const vector = sunVector(point);
      const lights = globe.lights?.();
      const directional = Array.isArray(lights)
        ? lights.find((light) => light.type === "DirectionalLight")
        : null;

      if (directional?.position?.set) {
        directional.position.set(vector.x, vector.y, vector.z);
      }

      updateSunHud(date, point);
      return point;
    };

    const stopSunTimer = () => {
      if (sunTimer) {
        window.clearInterval(sunTimer);
        sunTimer = null;
      }
    };

    const startSunSystem = (globe, entries) => {
      stopSunTimer();

      const tick = () => {
        const date = new Date();
        const sunEntry = makeSunEntry(date);
        updateSunlight(globe, date);
        globe.htmlElementsData([...entries, sunEntry]);
        window.requestAnimationFrame(() => setActiveMarker(activeMarkerId));
      };

      tick();

      if (!prefersReducedMotion.matches) {
        sunTimer = window.setInterval(tick, 30000);
      }
    };

    const createGlobeMarker = (entry) => {
      if (entry.kind === "sun") {
        const marker = document.createElement("span");
        marker.className = "sirui-sun-marker";
        marker.textContent = "sun";
        marker.setAttribute("aria-hidden", "true");
        return marker;
      }

      const button = document.createElement("button");
      const dot = document.createElement("span");
      const label = document.createElement("span");
      const count = document.createElement("span");
      const tooltip = document.createElement("span");

      button.type = "button";
      button.className = "sirui-globe-marker";
      button.dataset.entryId = entry.id;
      button.setAttribute("aria-label", `details for ${whereLabel(entry)}`);
      if (entry.isCurrent) button.classList.add("is-current", "is-active");

      dot.className = "sirui-globe-marker-dot";
      label.className = "sirui-globe-marker-label";
      count.className = "sirui-globe-marker-count";
      tooltip.className = "sirui-globe-marker-tooltip";
      label.textContent = shortPlaceLabel(entry);
      count.textContent = Number(entry.count) > 1 ? ` x${entry.count}` : "";
      tooltip.textContent = `${timezoneLabel(entry)} - ${entry.lastLocalTime || "visit time pending"}`;
      label.append(count);
      button.append(dot, label, tooltip);

      button.addEventListener("mouseenter", () => previewMarker(entry));
      button.addEventListener("mouseleave", clearMarkerPreview);
      button.addEventListener("focus", () => showMarkerDetails(entry));
      button.addEventListener("blur", hideMarkerDetails);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        showMarkerDetails(entry, { pinned: true });
        if (globeInstance && hasCoordinates(entry)) {
          globeInstance.pointOfView(
            {
              altitude: 1.35,
              lat: entry.lat,
              lng: entry.lng,
            },
            prefersReducedMotion.matches ? 0 : 900,
          );
        }
      });

      return button;
    };

    const buildUnlockArcs = (entries, activeEntry) => {
      if (!hasCoordinates(activeEntry)) return [];

      return entries
        .filter((entry) => entry.id !== activeEntry.id && hasCoordinates(entry))
        .slice(0, 7)
        .map((entry) => ({
          endLat: activeEntry.lat,
          endLng: activeEntry.lng,
          name: "local unlock trail",
          startLat: entry.lat,
          startLng: entry.lng,
        }));
    };

    const applyZoomMode = (pov, activeEntry) => {
      const altitude = Number(pov?.altitude) || 2.4;
      const isFar = altitude > 2.35;
      const isNear = altitude <= 1.42;

      mapStage?.classList.toggle("is-zoom-far", isFar);
      mapStage?.classList.toggle("is-zoom-mid", !isFar && !isNear);
      mapStage?.classList.toggle("is-zoom-near", isNear);

      if (isNear && hasCoordinates(activeEntry) && !detailsPinned) {
        showMarkerDetails(activeEntry);
      } else if (!detailsPinned && !isNear) {
        hideMarkerDetails();
      }
    };

    const resizeGlobe = () => {
      if (!globeInstance || !globeElement) return;

      const bounds = globeElement.getBoundingClientRect();
      globeInstance.width(Math.max(320, Math.floor(bounds.width)));
      globeInstance.height(Math.max(320, Math.floor(bounds.height)));

      const camera = globeInstance.camera?.();
      if (camera?.updateProjectionMatrix && bounds.height) {
        camera.aspect = bounds.width / bounds.height;
        camera.updateProjectionMatrix();
      }
    };

    const renderGlobe = async (entries, activeEntry) => {
      if (!globeElement || !hasWebGl()) return false;

      const Globe = await waitForGlobe();
      if (!Globe) return false;

      try {
        markerLayer?.replaceChildren();
        stopSunTimer();
        if (mapFallback) mapFallback.hidden = true;
        globeElement.classList.remove("is-fallback");
        globeElement.replaceChildren();
        if (globeResizeObserver) globeResizeObserver.disconnect();

        const activePoint = hasCoordinates(activeEntry)
          ? activeEntry
          : entries.find(hasCoordinates);
        const reducedMotion = prefersReducedMotion.matches;
        const globe = new Globe(globeElement, {
          animateIn: !reducedMotion,
          rendererConfig: {
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          },
          waitForGlobeReady: false,
        });

        globeInstance = globe;
        resizeGlobe();

        globe
          .backgroundColor("rgba(0, 0, 0, 0)")
          .showAtmosphere(true)
          .atmosphereColor("#70d8ff")
          .atmosphereAltitude(0.18)
          .globeCurvatureResolution(2)
          .pointsData(entries)
          .pointLat("lat")
          .pointLng("lng")
          .pointAltitude((entry) => (entry.isCurrent ? 0.08 : 0.035))
          .pointRadius((entry) => 0.18 + Math.min(Number(entry.count) || 1, 6) * 0.025)
          .pointColor((entry) => (entry.isCurrent ? "#ff4f9a" : "#8eea62"))
          .pointLabel((entry) => whereLabel(entry))
          .pointsTransitionDuration(reducedMotion ? 0 : 700)
          .ringsData(activePoint ? [activePoint] : [])
          .ringLat("lat")
          .ringLng("lng")
          .ringAltitude(0.012)
          .ringColor(() => "rgba(255, 79, 154, 0.78)")
          .ringMaxRadius(3.2)
          .ringPropagationSpeed(reducedMotion ? 0 : 1.4)
          .ringRepeatPeriod(reducedMotion ? 0 : 1200)
          .arcsData(buildUnlockArcs(entries, activeEntry))
          .arcLabel("name")
          .arcStartLat("startLat")
          .arcStartLng("startLng")
          .arcEndLat("endLat")
          .arcEndLng("endLng")
          .arcColor(() => ["rgba(112, 216, 255, 0.1)", "rgba(255, 79, 154, 0.8)"])
          .arcAltitudeAutoScale(0.32)
          .arcDashLength(0.36)
          .arcDashGap(0.18)
          .arcDashAnimateTime(reducedMotion ? 0 : 2600)
          .arcStroke(0.34)
          .htmlElementsData(entries)
          .htmlLat("lat")
          .htmlLng("lng")
          .htmlAltitude(0.09)
          .htmlElement(createGlobeMarker)
          .htmlTransitionDuration(reducedMotion ? 0 : 700)
          .htmlElementVisibilityModifier((element, isVisible) => {
            if (element.classList.contains("sirui-sun-marker")) {
              element.style.opacity = isVisible ? "" : "0";
              return;
            }

            element.style.opacity = isVisible ? "" : "0.12";
            element.style.pointerEvents = isVisible ? "auto" : "none";
            element.tabIndex = isVisible ? 0 : -1;
          })
          .onZoom((pov) => applyZoomMode(pov, activeEntry));

        if (globeTextureUrl || globeFallbackTextureUrl) {
          globe.globeImageUrl(globeTextureUrl || globeFallbackTextureUrl);
        }
        if (globeBumpUrl) globe.bumpImageUrl(globeBumpUrl);
        tuneGlobeRender(globe);

        const controls = globe.controls?.();
        if (controls) {
          controls.autoRotate = false;
          controls.autoRotateSpeed = 0;
          controls.enableDamping = true;
        }

        if (window.ResizeObserver) {
          globeResizeObserver = new ResizeObserver(resizeGlobe);
          globeResizeObserver.observe(globeElement);
        } else {
          window.addEventListener("resize", resizeGlobe, { passive: true });
        }

        applyZoomMode({ altitude: 2.45 }, activeEntry);

        if (activePoint) {
          globe.pointOfView(
            {
              altitude: reducedMotion ? 2.45 : 2.85,
              lat: activePoint.lat,
              lng: activePoint.lng,
            },
            0,
          );
          window.setTimeout(
            () =>
              globe.pointOfView(
                {
                  altitude: 2.45,
                  lat: activePoint.lat,
                  lng: activePoint.lng,
                },
                reducedMotion ? 0 : 1400,
              ),
            reducedMotion ? 0 : 300,
          );
        }

        startSunSystem(globe, entries);

        setGlobeStatus(
          activePoint
            ? `Signal acquired near ${whereLabel(activePoint)}.`
            : "Signal acquired, but this timezone is not on the where-ish map yet.",
        );

        return true;
      } catch (error) {
        stopSunTimer();
        console.warn("secret page globe failed", error);
        return false;
      }
    };

    const renderFallbackMap = (entries) => {
      if (!globeElement || !mapFallback || !markerLayer) return;

      stopSunTimer();
      globeElement.classList.add("is-fallback");
      mapFallback.hidden = false;
      markerLayer.replaceChildren(...entries.map(renderMarker));
      setGlobeStatus("Using the static where-ish fallback map.");
    };

    const renderMap = async (entries, activeEntry) => {
      if (!map) return;

      const normalizedEntries = entries.map(normalizeEntry);
      const normalizedActive =
        normalizedEntries.find((entry) => entry.id === activeEntry.id) ||
        normalizeEntry(activeEntry);
      const mappableEntries = normalizedEntries
        .filter(hasCoordinates)
        .slice()
        .sort((a, b) => (b.lastIso || "").localeCompare(a.lastIso || ""));

      clearPinnedDetails();
      renderReadout(normalizedActive);

      map.hidden = false;

      const globeRendered = await renderGlobe(
        mappableEntries.map((entry) => ({
          ...entry,
          isCurrent: entry.id === normalizedActive.id,
        })),
        {
          ...normalizedActive,
          isCurrent: true,
        },
      );

      if (!globeRendered) {
        renderFallbackMap(mappableEntries);
      }
    };

    const decryptSecret = async (password) => {
      const key = await deriveKey(password, b64ToBytes(container.dataset.salt));
      const decrypted = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: b64ToBytes(container.dataset.iv),
        },
        key,
        b64ToBytes(payload.textContent),
      );

      return new TextDecoder().decode(decrypted);
    };

    const unlock = async (password) => {
      message.textContent = "checking access...";
      message.classList.remove("is-unlocked", "sr-only");

      let decryptedHtml = "";
      try {
        decryptedHtml = await decryptSecret(password);
      } catch {
        safeSessionRemove(passwordKey);
        message.innerHTML =
          'wrong password. go back to the <a href="{{ "/blog/" | relative_url }}">blog page</a> and try the dog again.';
        return;
      }

      safeSessionRemove(passwordKey);
      secretCopy.innerHTML = decryptedHtml;
      secretNote.hidden = false;
      message.textContent = "access granted.";
      message.classList.add("is-unlocked", "sr-only");

      try {
        const visitorMeta = collectVisitorMeta();
        const unlockRecord = recordUnlock(visitorMeta);

        sendUnlockAnalytics(unlockRecord.activeEntry, visitorMeta);
        await renderMap(unlockRecord.entries, unlockRecord.activeEntry);
      } catch (error) {
        console.warn("secret page visitor readout failed", error);
      }
    };

    mapStage?.addEventListener("click", (event) => {
      if (!event.target.closest(".sirui-globe-marker, .sirui-map-marker-group")) {
        clearPinnedDetails();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !map?.hidden) {
        clearPinnedDetails();
      }
    });

    const storedPassword = safeSessionGet(passwordKey);

    if (storedPassword) {
      unlock(storedPassword);
    } else {
      message.innerHTML =
        'locked. enter through the dog on the <a href="{{ "/blog/" | relative_url }}">blog page</a>.';
    }
  })();
</script>

<noscript>This page needs JavaScript to unlock.</noscript>
