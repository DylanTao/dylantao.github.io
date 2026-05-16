---
layout: page
title: "sirui's secrets"
description: A tiny locked corner.
permalink: /blog/2026/sirui-research-thoughts/
sitemap: false
search: false
secret_globe: true
map: true
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
          Current visitor trace from this browser and the edge.
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

        <div class="sirui-view-controls" role="toolbar" aria-label="visitor map view modes">
          <button type="button" data-sirui-view="visitor" class="is-active">visitor</button>
          <button type="button" data-sirui-view="street">street</button>
          <button type="button" data-sirui-view="sun">sun</button>
          <button type="button" data-sirui-view="moon">moon</button>
          <button type="button" data-sirui-view="orbit">orbit</button>
        </div>

        <div id="sirui-street-map-panel" class="sirui-street-map-panel" hidden aria-live="polite">
          <div class="sirui-street-map-header">
            <span>street zoom</span>
            <strong id="sirui-street-map-title">nearby map</strong>
          </div>
          <div
            id="sirui-street-map"
            class="sirui-street-map"
            role="application"
            aria-label="Synced OpenStreetMap street view"
          ></div>
        </div>

        <div id="sirui-sky-cockpit" class="sirui-sky-cockpit" hidden aria-live="polite">
          <div class="sirui-sky-orbit" aria-hidden="true">
            <span class="sirui-sky-sun"></span>
            <span class="sirui-sky-earth"></span>
            <span class="sirui-sky-moon"></span>
          </div>
          <div class="sirui-sky-copy">
            <span id="sirui-sky-mode" class="sirui-sky-mode">sky</span>
            <strong id="sirui-sky-title">celestial cockpit</strong>
            <dl>
              <div>
                <dt>subpoint</dt>
                <dd id="sirui-sky-subpoint">--</dd>
              </div>
              <div>
                <dt>phase</dt>
                <dd id="sirui-sky-phase">--</dd>
              </div>
              <div>
                <dt>scale cue</dt>
                <dd id="sirui-sky-scale">--</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside id="sirui-marker-card" class="sirui-marker-card" hidden>
          <button id="sirui-marker-close" class="sirui-marker-close" type="button" aria-label="Close marker details">x</button>
          <p class="sirui-marker-kicker">marker details</p>
          <h3 id="sirui-marker-title">visitor</h3>
          <dl id="sirui-marker-facts"></dl>
        </aside>

        <div class="sirui-time-controls" role="toolbar" aria-label="sky time controls">
          <button type="button" data-sirui-time-step="-1">-1h</button>
          <button type="button" data-sirui-time-mode="pause">pause</button>
          <button type="button" data-sirui-time-mode="realtime">realtime</button>
          <button type="button" data-sirui-time-mode="fast" class="is-active">90x</button>
          <button type="button" data-sirui-time-step="1">+1h</button>
        </div>

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
          <span>orbit sim</span>
          <span id="sirui-sun-utc">UTC --</span>
          <span id="sirui-orbit-clock">1x</span>
          <span id="sirui-sun-point">sun --</span>
          <span id="sirui-moon-point">moon --</span>
        </div>
      </div>

      <div class="sirui-map-dock">
        <div class="sirui-map-readout sirui-info-panel" aria-live="polite">
          <span class="sirui-readout-label">where-ish</span>
          <h3 id="sirui-map-place">signal pending</h3>
          <p id="sirui-map-timezone">timezone pending</p>
          <dl>
            <div>
              <dt>visit time</dt>
              <dd id="sirui-map-time">--</dd>
            </div>
            <div>
              <dt>source</dt>
              <dd id="sirui-location-source">source pending</dd>
            </div>
            <div>
              <dt>this browser</dt>
              <dd id="sirui-map-count">--</dd>
            </div>
          </dl>
          <div class="sirui-location-actions">
            <button id="sirui-sharpen-location" class="sirui-sharpen-location" type="button" hidden>precise location</button>
          </div>
        </div>

        <div class="sirui-info-panel">
          <span class="sirui-readout-label">street</span>
          <h3 id="sirui-info-street-mode">globe view</h3>
          <p id="sirui-info-street-center">center pending</p>
          <dl>
            <div>
              <dt>map zoom</dt>
              <dd id="sirui-info-street-zoom">--</dd>
            </div>
            <div>
              <dt>accuracy</dt>
              <dd id="sirui-info-street-accuracy">--</dd>
            </div>
          </dl>
        </div>

        <div class="sirui-info-panel">
          <span class="sirui-readout-label">network</span>
          <h3 id="sirui-map-ip">--</h3>
          <p id="sirui-map-edge-location">edge location pending</p>
          <dl>
            <div>
              <dt>ASN</dt>
              <dd id="sirui-info-asn">--</dd>
            </div>
            <div>
              <dt>observed</dt>
              <dd id="sirui-info-edge-time">--</dd>
            </div>
          </dl>
        </div>

        <div class="sirui-info-panel">
          <span class="sirui-readout-label">sky</span>
          <h3 id="sirui-info-sky-title">live sky</h3>
          <p id="sirui-info-sky-summary">Sun and Moon subpoints pending.</p>
          <dl>
            <div>
              <dt>UTC</dt>
              <dd id="sirui-info-sky-utc">--</dd>
            </div>
            <div>
              <dt>clock</dt>
              <dd id="sirui-info-sky-clock">--</dd>
            </div>
          </dl>
        </div>
      </div>

    </div>

  </section>

  <section id="sirui-secret-note-wrap" class="sirui-secret-note" hidden aria-label="decrypted note">
    <div id="sirui-secret-copy" class="sirui-secret-copy"></div>
  </section>

  <script type="text/plain" id="sirui-private-payload">
    Bxfcy2a+8pLbeOzHOQ/555u5HYPjatTgVwI95G1htSooIvVvFzHjKh6PM1vq6gPIdCASMPIFm1hCCANu6dMuXp/x7Q8phG3lCTkvTL94bWNBEdOp2XhLU7iKjDeYwBg6gKDNDzG1Pujoorcx+s4ungQRahXUL3dK2y4/J++KceHAUS2uYxqpXPaNBlcsBNoXgPEn6SzGtFMzJTPuEwYuBm6TkQcxCD0vTEam1N0X8ajFm8i9y96NyxFpOFVPotk2WDt66zoqUFy58/FWJxg6jyg3CF4r8iRrFOLk9KBEiaX1pEO4zqTZdlntvuYmA3JUbTHw/lW0zZgwmu26QDJJJ+C+cOe7a2cQ1Z2RqNCyN8glvHtGwSsZXS0vWSt4ISO7VDmZo+GtQ54A3ELaVGIEwmC4qf6Re3FlZfQkhqRYf6rfTp8YIeS/SgFYdOJSKBGPxrKJ/38mlbTXlDj4CxY8cK5BZtxswj6c3nAAIcO5FaJn0bm/LQXY9Dr/eUnQbUgTQoQgAEbn41jUv68IbFnl7NkAls2m5Odq9kYt0IUiD3jr8nRxosp8roARViwl37PNlyyaNYKJYz40SBe2Zy6faT0O1ficOSqeWdl8kZAHyoHntTujEoo0rKrdh4T+BZX4rM8NGqje1MiHhc13QfyMXvHJONRn/AWy6j9uuI7hCU5pu2PH0ETG16WS6rxiDENkiYPMwH5y0uDTI8loD25Y5CNlOcYbTomC11jv1PHwFvDQiGpfEoWh/18yDgsXmGRvB30gfgr0gxFYGZhdOtIOhokC/qURV9E+3DzJhoqSR2/rFhHaJNESd/ZIlJIeBb4j2P3YqrpgFJj353fo+Lz5F9yMUn1ZYOEyJ/R8UlFCRsXVilrh6clFbwOKn6xfxT7g3SzS0RmUc2zXWi5VGtI085xaLhtdUxUskwyRHujwkekeIVqtZK1UXnuUFZb/9XyK8Vq4RWkKqARBiN95LgCD0ZcfzSWdLr+ffekfvRnq6wNtR67PeYToNdiYT5qp8S1stmQoXWLDp89qe1sDpMXEqQjA6N+vAJmK8pdjgrQrF+tEmP3OOiKGlAGubhrM5N1ka1KfHR6U5oWPHmYWXzae/b1lJ2oE6CShv8XksWYP48XGOWmIFzIrfJxNsegpK5A8LIpBts37q7V+1ZIi/iteCu9pffOGiX8p9VC1jHbym/yNdZVyc43oQbwwLY8zPguB15zMac3JbH9QogM5aBs3Xro4ZTudrtidVmkjO9PeF2pjzJNrC9sTgiMphwnvntslvU8Pt1HBAxb6mIsA18SglB0aR2lX3eNLLfKFzaQZ8BgznZpezH+LLr0OlSc8Y/GKPzjpUX/8VlwSQRM2V4bdXM5G+bKT1FLbXG9AR2mFoTTvTMsIM5kuTdqpeTM4YNkrian2XbxsJ7c4atPlQQGOsIpvVVPqQKOAiy+RJWyUE6hwbGGVUSzJl88acfl53X1Ci4JbBhz99JtTtgpDYpctRNsyJaoLPlOohZ2hMC4ra3BIrubMVbuMAJ8PQbOp5ptIfxGrGDl84y98vJ6OdgnDiyDrAclx542wm2bYamGYsgMkahClnyYoxg3Wa9pPYRAMerppMvHzCcgnuUpHkaa9wSbznvgpTT90py/4bL7+qDBGgHFHSCWmU1cDeh+wLO5ZADEqyIXRibQOgdA8K40MVtmYgsb6PQl2XZphxWaNSV8TvmsTEbbUEedHQ11WcGEgicHl8XXt5H7Hga80LAE2ABGCpPhuMP3XELY6zeqQRivq2hPKmlkYH6PYD4dR6aAjuFYmaaaUV7xKfYmBXeiKxxIgJzZI9PEKqS4wDqMbPMCkvIsUSXRr7pTW6Ky8oTXWr2pRGHOUKD8crjFjWsCeXjWT+7UByBWWF4xDGqjGczEsqR3i/d+4Dk+Q3OcDtDgwb/qXWsYMONwUZUvDJsCZfN2Tte+nOxmtosfxBnX5IMa0egfAzkBq9FExkQ32/xMKlMjsOydwXarRnp40kBqbDWBAGApr4S2sBLw3o/o5AD/Z0hBgkl1BJ5EzVvCTCz35ODOEtXBJ/hU329oJRWLjhu4jqBdbeBbii2GAPqiW80Hr89wxpwNofXpvessB3TIafAhbuF9zJ3W4Uz7KynMSYR+dINFFD3aCp3zqq5qlfLtlmtqrvhjDv5OFiOifhGQjDMCgR2OjdEIFL5dpsMYrMJf4TVzyQjLlXkdC6b3SvKf0HNxQUPNvkD92QvTdFr12glOgVEYWcpeoDD6aRxaMuS9a9vzFncdgGNVKUE2ZhqaLR8ZoEHgsLRFUxdlqVQ65j5KhkUAUvtbf9qBri7NL+P1vVWB2eePYhMtP2RyNqeBCHgut8HKS1Ch/kN9o+awbILT+113FYA9v5V3AGqGnCF4BekfjiKa7+HLgp/WGarLqTpUS8vTr+PEVDTk/jDglyIMmhQfTrrO2Olt0ixQOSLwhhx2TxJkDlzKG3u0X6H/7hcfXOl1PZGRyUrg/E827RyLTpbBKcvu4kvlNywMKMRGCFQ==
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
    margin-left: 50%;
    margin-top: 0.9rem;
    transform: translateX(-50%);
    width: min(94vw, 88rem);
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
    display: grid;
    gap: 0.8rem;
    grid-template-areas:
      "top top"
      "stage dock"
      "foot foot";
    grid-template-columns: minmax(0, 2.15fr) minmax(18rem, 0.85fr);
    overflow: hidden;
    padding: clamp(0.9rem, 1.6vw, 1.2rem);
  }

  .sirui-map-topline {
    align-items: end;
    display: grid;
    gap: 0.4rem 1rem;
    grid-area: top;
    grid-template-columns: auto minmax(16rem, 1fr);
    max-width: none;
  }

  .sirui-console-status {
    align-items: center;
    color: var(--sirui-console-muted);
    display: flex;
    flex-wrap: wrap;
    font-size: 0.78rem;
    gap: 0.38rem 0.55rem;
    grid-column: 1 / -1;
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
    font-size: 2.75rem;
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
    align-self: center;
    font-size: 0.86rem;
    margin-top: 0;
    max-width: 44rem;
  }

  .sirui-map-footnote {
    font-size: 0.8rem;
    grid-area: foot;
    margin-top: 0.9rem;
  }

  .sirui-map-stage {
    grid-area: stage;
    isolation: isolate;
    margin-top: 0;
    min-width: 0;
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
    min-width: 0;
    min-height: 25rem;
    overflow: hidden;
    position: relative;
  }

  .sirui-globe-canvas {
    height: clamp(32rem, 68vh, 49rem);
  }

  .sirui-globe-canvas canvas {
    display: block;
    max-width: 100%;
  }

  .sirui-globe-canvas::after,
  .sirui-map-fallback::after {
    background:
      radial-gradient(circle at 50% 50%, transparent 48%, rgba(112, 216, 255, 0.08) 72%, rgba(5, 8, 6, 0.26) 100%),
      linear-gradient(90deg, rgba(255, 255, 255, 0.018), transparent 16%, transparent 84%, rgba(255, 255, 255, 0.018));
    background-size:
      100% 100%,
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
    display: none;
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
    transform: translate(-50%, -50%) scale(var(--sirui-marker-scale, 1));
    transform-origin: center;
    transition:
      opacity 160ms ease,
      transform 160ms ease;
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

  .sirui-celestial-marker {
    align-items: center;
    background: transparent;
    border: 0;
    color: #ffcc7d;
    cursor: pointer;
    display: grid;
    font-size: 0.68rem;
    font-weight: 800;
    height: 3.4rem;
    justify-items: center;
    letter-spacing: 0;
    padding: 0;
    pointer-events: auto;
    position: relative;
    transform: translate(-50%, -50%);
    transition:
      filter 180ms ease,
      opacity 180ms ease,
      transform 180ms ease;
    width: 3.4rem;
    white-space: nowrap;
  }

  .sirui-celestial-marker::before {
    background: radial-gradient(circle, rgba(255, 184, 86, 0.46), rgba(255, 184, 86, 0.08) 52%, transparent 72%);
    border-radius: 50%;
    content: "";
    height: 3.1rem;
    position: absolute;
    width: 3.1rem;
  }

  .sirui-celestial-marker:focus-visible {
    outline: 2px solid var(--sirui-console-cyan);
    outline-offset: 0.2rem;
  }

  .sirui-celestial-marker:hover,
  .sirui-celestial-marker:focus-visible,
  .sirui-celestial-marker.is-active {
    filter: brightness(1.18) saturate(1.08);
    transform: translate(-50%, -50%) scale(1.08);
  }

  .sirui-celestial-core {
    border-radius: 50%;
    display: block;
    height: 1.15rem;
    position: relative;
    width: 1.15rem;
    z-index: 1;
  }

  .sirui-celestial-marker.is-sun .sirui-celestial-core {
    background:
      radial-gradient(circle at 38% 34%, #fff7c8 0 14%, #ffd36f 34%, #ff8f3d 62%, #9f3c16 100%);
    box-shadow:
      0 0 0 0.2rem rgba(255, 184, 86, 0.12),
      0 0 1.1rem rgba(255, 184, 86, 0.86),
      0 0 2.5rem rgba(255, 112, 48, 0.38);
  }

  .sirui-celestial-marker.is-moon {
    color: #edf5ff;
  }

  .sirui-celestial-marker.is-moon::before {
    background: radial-gradient(circle, rgba(220, 235, 255, 0.28), rgba(220, 235, 255, 0.06) 54%, transparent 74%);
  }

  .sirui-celestial-marker.is-moon .sirui-celestial-core {
    background:
      radial-gradient(circle at 36% 34%, #ffffff 0 12%, #dbeaff 36%, #7f99be 72%, #35465c 100%);
    box-shadow:
      0 0 0 0.18rem rgba(220, 235, 255, 0.1),
      0 0 1rem rgba(220, 235, 255, 0.62);
    overflow: hidden;
  }

  .sirui-celestial-marker.is-moon .sirui-celestial-core::after {
    background: rgba(5, 8, 6, 0.78);
    border-radius: 50%;
    content: "";
    inset: -0.08rem -0.18rem 0.08rem 0.34rem;
    position: absolute;
  }

  .sirui-celestial-label {
    background: rgba(5, 8, 6, 0.7);
    border: 1px solid rgba(244, 248, 239, 0.14);
    border-radius: 999px;
    bottom: -0.58rem;
    color: currentColor;
    font-size: 0.66rem;
    line-height: 1;
    opacity: 0;
    padding: 0.22rem 0.38rem;
    position: absolute;
    transform: translateY(0.18rem);
    transition:
      opacity 160ms ease,
      transform 160ms ease;
    z-index: 2;
  }

  .sirui-celestial-marker:hover .sirui-celestial-label,
  .sirui-celestial-marker:focus-visible .sirui-celestial-label,
  .sirui-celestial-marker.is-active .sirui-celestial-label {
    opacity: 1;
    transform: translateY(0);
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

  .sirui-map-stage.is-zoom-near .sirui-globe-marker {
    --sirui-marker-scale: 0.58;
  }

  .sirui-map-stage.is-zoom-near .sirui-globe-marker-label {
    font-size: 0.66rem;
    padding: 0.22rem 0.36rem;
  }

  .sirui-map-stage.is-zoom-near .sirui-globe-marker-dot {
    height: 0.52rem;
    width: 0.52rem;
  }

  .sirui-map-stage.is-zoom-near .sirui-globe-marker.is-active .sirui-globe-marker-dot,
  .sirui-map-stage.is-zoom-near .sirui-globe-marker:hover .sirui-globe-marker-dot,
  .sirui-map-stage.is-zoom-near .sirui-globe-marker:focus-visible .sirui-globe-marker-dot {
    box-shadow:
      0 0 0 0.25rem rgba(255, 79, 154, 0.14),
      0 0 0.85rem rgba(255, 79, 154, 0.58);
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

  .sirui-street-map-panel {
    background: rgba(5, 8, 6, 0.86);
    border: 1px solid rgba(112, 216, 255, 0.28);
    border-radius: 0.45rem;
    box-shadow: 0 0.9rem 2rem rgba(0, 0, 0, 0.38);
    color: var(--sirui-console-text);
    overflow: hidden;
    position: absolute;
    right: 0.75rem;
    top: 0.75rem;
    width: min(19rem, calc(100% - 1.5rem));
    z-index: 4;
  }

  .sirui-street-map-panel[hidden] {
    display: none;
  }

  .sirui-street-map-header {
    align-items: baseline;
    display: flex;
    gap: 0.45rem;
    justify-content: space-between;
    padding: 0.45rem 0.55rem;
  }

  .sirui-street-map-header span {
    color: var(--sirui-console-cyan);
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .sirui-street-map-header strong {
    color: var(--sirui-console-muted);
    font-size: 0.72rem;
    font-weight: 700;
    min-width: 0;
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sirui-street-map {
    background: rgba(244, 248, 239, 0.08);
    border: 0;
    display: block;
    filter: saturate(0.78) contrast(0.96) brightness(0.9);
    height: 12rem;
    width: 100%;
  }

  .sirui-map-dock {
    align-items: start;
    display: grid;
    gap: 0.8rem;
    grid-area: dock;
    grid-template-columns: 1fr;
    margin-top: 0;
    min-width: 0;
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

  .sirui-location-actions {
    align-items: center;
    border-top: 1px solid rgba(244, 248, 239, 0.12);
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.7rem;
    padding-top: 0.7rem;
  }

  .sirui-location-actions span {
    color: var(--sirui-console-muted);
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .sirui-sharpen-location {
    background: rgba(112, 216, 255, 0.11);
    border: 1px solid rgba(112, 216, 255, 0.36);
    border-radius: 0.35rem;
    color: var(--sirui-console-text);
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0;
    line-height: 1.2;
    min-height: 2.15rem;
    padding: 0.45rem 0.6rem;
  }

  .sirui-sharpen-location:hover,
  .sirui-sharpen-location:focus-visible {
    background: rgba(255, 79, 154, 0.16);
    border-color: rgba(255, 79, 154, 0.5);
  }

  .sirui-sharpen-location:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .sirui-sharpen-location[hidden] {
    display: none;
  }

  .sirui-marker-card {
    max-height: min(31rem, 58vh);
    overflow: auto;
  }

  .sirui-marker-card[hidden] {
    display: none;
  }

  .sirui-map-shell {
    --sirui-stage-height: clamp(22rem, calc(100vh - 17rem), 44rem);
    grid-template-areas:
      "top"
      "stage"
      "dock";
    grid-template-columns: 1fr;
  }

  .sirui-crack-map {
    margin-bottom: 2.5rem;
    width: min(94vw, 92rem);
  }

  .sirui-map-stage {
    min-height: var(--sirui-stage-height);
  }

  .sirui-globe-canvas,
  .sirui-map-fallback,
  .sirui-street-map-panel {
    height: var(--sirui-stage-height);
    min-height: 0;
  }

  .sirui-view-controls,
  .sirui-time-controls {
    align-items: center;
    background: rgba(5, 8, 6, 0.7);
    border: 1px solid rgba(244, 248, 239, 0.14);
    border-radius: 999px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.22rem;
    left: 0.75rem;
    padding: 0.24rem;
    position: absolute;
    z-index: 7;
  }

  .sirui-view-controls {
    top: 0.75rem;
  }

  .sirui-time-controls {
    bottom: 0.75rem;
  }

  .sirui-view-controls button,
  .sirui-time-controls button {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 999px;
    color: var(--sirui-console-muted);
    cursor: pointer;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0;
    line-height: 1;
    min-height: 1.65rem;
    padding: 0.36rem 0.48rem;
    text-transform: uppercase;
  }

  .sirui-view-controls button:hover,
  .sirui-view-controls button:focus-visible,
  .sirui-view-controls button.is-active,
  .sirui-time-controls button:hover,
  .sirui-time-controls button:focus-visible,
  .sirui-time-controls button.is-active {
    background: rgba(112, 216, 255, 0.13);
    border-color: rgba(112, 216, 255, 0.34);
    color: var(--sirui-console-text);
  }

  .sirui-street-map-panel {
    background: rgba(5, 8, 6, 0.96);
    border: 1px solid rgba(112, 216, 255, 0.28);
    inset: 0;
    position: absolute;
    width: auto;
    z-index: 4;
  }

  .sirui-street-map-header {
    background: rgba(5, 8, 6, 0.88);
    border-bottom: 1px solid rgba(244, 248, 239, 0.12);
    left: 0.75rem;
    max-width: min(32rem, calc(100% - 1.5rem));
    position: absolute;
    top: 0.75rem;
    z-index: 2;
  }

  .sirui-street-map {
    filter: saturate(0.92) contrast(1.02) brightness(0.98);
    height: 100%;
  }

  .sirui-street-map .leaflet-control-attribution {
    background: rgba(255, 255, 255, 0.78);
    font-size: 0.62rem;
  }

  .sirui-street-pin {
    background: var(--sirui-console-hot);
    border: 2px solid #10130f;
    border-radius: 50%;
    box-shadow:
      0 0 0 0.38rem rgba(255, 79, 154, 0.22),
      0 0 1.1rem rgba(255, 79, 154, 0.66);
    height: 0.9rem;
    width: 0.9rem;
  }

  .sirui-street-pin-wrap {
    background: transparent;
    border: 0;
  }

  .sirui-street-pin-wrap .sirui-street-pin {
    display: block;
  }

  .sirui-map-stage.is-street-mode .sirui-globe-canvas {
    border-color: rgba(112, 216, 255, 0.42);
    bottom: 0.75rem;
    box-shadow: 0 0.8rem 1.8rem rgba(0, 0, 0, 0.4);
    height: clamp(8.5rem, 24vh, 13rem);
    min-height: 0;
    opacity: 0.94;
    position: absolute;
    right: 0.75rem;
    width: min(19rem, 36vw);
    z-index: 6;
  }

  .sirui-map-stage.is-street-mode .sirui-globe-canvas::after {
    opacity: 0.36;
  }

  .sirui-map-stage.is-street-mode .sirui-sun-hud,
  .sirui-map-stage.is-street-mode .sirui-time-controls {
    opacity: 0;
    pointer-events: none;
  }

  .sirui-map-stage.is-street-mode .sirui-globe-marker:not(.is-current),
  .sirui-map-stage.is-street-mode .sirui-celestial-marker {
    opacity: 0.22;
  }

  .sirui-map-stage.is-zoom-near .sirui-globe-marker {
    --sirui-marker-scale: 0.92;
  }

  .sirui-map-stage.is-zoom-near .sirui-globe-marker-label {
    font-size: 0.72rem;
    padding: 0.28rem 0.45rem;
  }

  .sirui-map-stage.is-zoom-near .sirui-globe-marker-dot {
    height: 0.72rem;
    width: 0.72rem;
  }

  .sirui-celestial-marker {
    height: 2.3rem;
    width: 2.3rem;
  }

  .sirui-celestial-marker::before {
    height: 1.8rem;
    opacity: 0.52;
    width: 1.8rem;
  }

  .sirui-celestial-core {
    height: 0.7rem;
    width: 0.7rem;
  }

  .sirui-sky-cockpit {
    align-items: center;
    background: rgba(5, 8, 6, 0.76);
    border: 1px solid rgba(255, 184, 86, 0.2);
    border-radius: 0.55rem;
    box-shadow: 0 0.9rem 2rem rgba(0, 0, 0, 0.34);
    display: grid;
    gap: 0.8rem;
    grid-template-columns: 8rem minmax(0, 1fr);
    max-width: min(30rem, calc(100% - 1.5rem));
    padding: 0.75rem;
    position: absolute;
    right: 0.75rem;
    top: 0.75rem;
    z-index: 6;
  }

  .sirui-sky-cockpit[hidden] {
    display: none;
  }

  .sirui-sky-orbit {
    aspect-ratio: 1;
    border: 1px solid rgba(220, 235, 255, 0.14);
    border-radius: 50%;
    position: relative;
  }

  .sirui-sky-sun,
  .sirui-sky-earth,
  .sirui-sky-moon {
    border-radius: 50%;
    position: absolute;
  }

  .sirui-sky-sun {
    background: radial-gradient(circle at 34% 32%, #fff7c8 0 12%, #ffd36f 36%, #ff8f3d 68%, #7f2d0e 100%);
    box-shadow:
      0 0 1rem rgba(255, 184, 86, 0.84),
      0 0 2.6rem rgba(255, 112, 48, 0.38);
    height: 1.45rem;
    left: 0.45rem;
    top: 0.65rem;
    width: 1.45rem;
  }

  .sirui-sky-earth {
    background:
      radial-gradient(circle at 44% 38%, rgba(244, 248, 239, 0.82), transparent 12%),
      radial-gradient(circle at 54% 54%, #1a7fa8 0 24%, #145b69 40%, #0d2e36 100%);
    border: 1px solid rgba(112, 216, 255, 0.46);
    height: 3.9rem;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 3.9rem;
  }

  .sirui-sky-moon {
    background: radial-gradient(circle at 35% 32%, #ffffff 0 18%, #dbeaff 38%, #607086 100%);
    box-shadow: 0 0 0.8rem rgba(220, 235, 255, 0.44);
    height: 1.06rem;
    right: 1rem;
    top: 1.15rem;
    width: 1.06rem;
  }

  .sirui-sky-copy {
    min-width: 0;
  }

  .sirui-sky-mode {
    color: #ffb856;
    display: block;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .sirui-sky-copy strong {
    color: var(--sirui-console-text);
    display: block;
    font-size: 1rem;
    line-height: 1.2;
    margin: 0.1rem 0 0.5rem;
  }

  .sirui-sky-copy dl {
    display: grid;
    gap: 0.35rem;
    margin: 0;
  }

  .sirui-sky-copy div,
  .sirui-info-panel dl div {
    border-top: 1px solid rgba(244, 248, 239, 0.12);
    padding-top: 0.35rem;
  }

  .sirui-sky-copy dt,
  .sirui-info-panel dt {
    color: var(--sirui-console-muted);
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0;
    margin: 0;
    text-transform: uppercase;
  }

  .sirui-sky-copy dd,
  .sirui-info-panel dd {
    color: var(--sirui-console-text);
    font-size: 0.76rem;
    margin: 0.06rem 0 0;
  }

  .sirui-map-dock {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .sirui-info-panel {
    background: rgba(16, 19, 15, 0.78);
    border: 1px solid var(--sirui-console-border);
    border-radius: 0.5rem;
    box-shadow: 0 0.5rem 1.2rem rgba(0, 0, 0, 0.2);
    min-height: 0;
    overflow: hidden;
    padding: 0.72rem;
  }

  .sirui-info-panel h3 {
    color: var(--sirui-console-text);
    font-size: 0.92rem;
    line-height: 1.2;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sirui-info-panel p {
    color: var(--sirui-console-muted);
    font-size: 0.72rem;
    line-height: 1.35;
    margin: 0.2rem 0 0.55rem;
    min-height: 1rem;
  }

  .sirui-info-panel dl {
    display: grid;
    gap: 0.35rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0;
  }

  .sirui-location-actions {
    margin-top: 0.45rem;
    padding-top: 0.45rem;
  }

  .sirui-marker-card {
    bottom: 0.75rem;
    left: 0.75rem;
    max-height: min(18rem, 48%);
    max-width: min(34rem, calc(100% - 1.5rem));
    overflow: auto;
    position: absolute;
    right: auto;
    width: max-content;
    z-index: 8;
  }

  .sirui-marker-close {
    background: rgba(244, 248, 239, 0.08);
    border: 1px solid rgba(244, 248, 239, 0.18);
    border-radius: 50%;
    color: var(--sirui-console-muted);
    cursor: pointer;
    font-size: 0.75rem;
    height: 1.5rem;
    line-height: 1;
    position: absolute;
    right: 0.55rem;
    top: 0.55rem;
    width: 1.5rem;
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

  @media (max-width: 980px) {
    .sirui-map-shell {
      grid-template-areas:
        "top"
        "stage"
        "dock"
        "foot";
      grid-template-columns: 1fr;
    }

    .sirui-map-dock {
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    }
  }

  @media (max-width: 720px) {
    .sirui-crack-map {
      width: min(94vw, 42rem);
    }

    .sirui-map-shell {
      padding: 0.85rem;
    }

    .sirui-map-topline {
      grid-template-columns: 1fr;
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

    .sirui-street-map-panel {
      bottom: auto;
      inset: 0;
      top: 0;
      width: auto;
    }

    .sirui-street-map {
      height: 100%;
    }
  }

  @media (max-width: 480px) {
    .sirui-map-topline h2 {
      font-size: 2.15rem;
    }

    .sirui-globe-canvas {
      height: var(--sirui-stage-height);
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
    .sirui-celestial-marker,
    .sirui-celestial-label,
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
    const mapShell = map?.querySelector(".sirui-map-shell");
    const mapStage = map?.querySelector(".sirui-map-stage");
    const globeElement = document.getElementById("sirui-globe");
    const globeStatus = document.getElementById("sirui-globe-status");
    const streetMapPanel = document.getElementById("sirui-street-map-panel");
    const streetMapElement = document.getElementById("sirui-street-map");
    const streetMapTitle = document.getElementById("sirui-street-map-title");
    const mapFallback = document.getElementById("sirui-map-fallback");
    const markerLayer = document.getElementById("sirui-map-markers");
    const markerCard = document.getElementById("sirui-marker-card");
    const markerClose = document.getElementById("sirui-marker-close");
    const markerTitle = document.getElementById("sirui-marker-title");
    const markerFacts = document.getElementById("sirui-marker-facts");
    const mapPlace = document.getElementById("sirui-map-place");
    const mapTimezone = document.getElementById("sirui-map-timezone");
    const mapTime = document.getElementById("sirui-map-time");
    const mapIp = document.getElementById("sirui-map-ip");
    const mapEdgeLocation = document.getElementById("sirui-map-edge-location");
    const mapCount = document.getElementById("sirui-map-count");
    const locationSource = document.getElementById("sirui-location-source");
    const streetModeLabel = document.getElementById("sirui-info-street-mode");
    const streetCenter = document.getElementById("sirui-info-street-center");
    const streetZoomReadout = document.getElementById("sirui-info-street-zoom");
    const streetAccuracy = document.getElementById("sirui-info-street-accuracy");
    const networkAsn = document.getElementById("sirui-info-asn");
    const networkObserved = document.getElementById("sirui-info-edge-time");
    const skyPanel = document.getElementById("sirui-sky-cockpit");
    const skyMode = document.getElementById("sirui-sky-mode");
    const skyTitle = document.getElementById("sirui-sky-title");
    const skySubpoint = document.getElementById("sirui-sky-subpoint");
    const skyPhase = document.getElementById("sirui-sky-phase");
    const skyScale = document.getElementById("sirui-sky-scale");
    const skyInfoTitle = document.getElementById("sirui-info-sky-title");
    const skyInfoSummary = document.getElementById("sirui-info-sky-summary");
    const skyInfoUtc = document.getElementById("sirui-info-sky-utc");
    const skyInfoClock = document.getElementById("sirui-info-sky-clock");
    const sharpenLocationButton = document.getElementById("sirui-sharpen-location");
    const viewModeButtons = Array.from(document.querySelectorAll("[data-sirui-view]"));
    const timeModeButtons = Array.from(document.querySelectorAll("[data-sirui-time-mode]"));
    const timeStepButtons = Array.from(document.querySelectorAll("[data-sirui-time-step]"));
    const statusPlace = document.getElementById("sirui-status-place");
    const statusTime = document.getElementById("sirui-status-time");
    const statusCount = document.getElementById("sirui-status-count");
    const sunUtc = document.getElementById("sirui-sun-utc");
    const orbitClock = document.getElementById("sirui-orbit-clock");
    const sunPoint = document.getElementById("sirui-sun-point");
    const moonPoint = document.getElementById("sirui-moon-point");

    const logKey = "siruiResearchThoughtsCrackLog";
    const browserIdKey = "siruiResearchThoughtsBrowserId";
    const passwordKey = "siruiResearchThoughtsPassword";
    const readoutVersion = "globe_v1";
    const visitorEndpoint = "{{ site.sirui_visitor_endpoint | default: '' }}".trim();
    const svgNamespace = "http://www.w3.org/2000/svg";
    const globeTextureUrl = "{{ site.third_party_libraries.three-globe.url.earth_day }}";
    const globeFallbackTextureUrl = "{{ site.third_party_libraries.three-globe.url.earth_blue_marble }}";
    const globeBumpUrl = "{{ site.third_party_libraries.three-globe.url.earth_topology }}";
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const streetModeAltitude = 1.55;
    const defaultStreetZoom = 17;

    let globeInstance = null;
    let globeResizeObserver = null;
    let streetMapInstance = null;
    let streetMarker = null;
    let streetAccuracyCircle = null;
    let sunTimer = null;
    let celestialBaseRealTime = Date.now();
    let celestialBaseSimTime = celestialBaseRealTime;
    let celestialSpeed = prefersReducedMotion.matches ? 0 : 90;
    let celestialMode = prefersReducedMotion.matches ? "pause" : "fast";
    let activeMarkerId = "";
    let lastUnlockRecord = null;
    let browserPrecisionRequestInFlight = false;
    let currentGlobeAltitude = 2.45;
    let currentGlobeEntries = [];
    let focusedGlobeEntry = null;
    let activeViewMode = "visitor";
    let streetSyncLocked = false;
    let globeSyncLocked = false;
    let lastSkySnapshot = null;

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

    const nearbyBrowserPlaces = [
      {
        city: "San Diego",
        countryName: "United States",
        lat: 32.8328,
        lng: -117.2713,
        neighborhood: "La Jolla",
        regionCode: "CA",
      },
      {
        city: "San Diego",
        countryName: "United States",
        lat: 32.7157,
        lng: -117.1611,
        regionCode: "CA",
      },
      {
        city: "Los Angeles",
        countryName: "United States",
        lat: 34.0522,
        lng: -118.2437,
        regionCode: "CA",
      },
      {
        city: "San Francisco",
        countryName: "United States",
        lat: 37.7749,
        lng: -122.4194,
        regionCode: "CA",
      },
      {
        city: "Seattle",
        countryName: "United States",
        lat: 47.6062,
        lng: -122.3321,
        regionCode: "WA",
      },
      {
        city: "New York",
        countryName: "United States",
        lat: 40.7128,
        lng: -74.006,
        regionCode: "NY",
      },
      {
        city: "Chicago",
        countryName: "United States",
        lat: 41.8781,
        lng: -87.6298,
        regionCode: "IL",
      },
      {
        city: "Boston",
        countryName: "United States",
        lat: 42.3601,
        lng: -71.0589,
        regionCode: "MA",
      },
    ];

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

    const toFiniteNumber = (value) => {
      if (value === undefined || value === null || String(value).trim() === "") {
        return null;
      }

      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };

    const formatPlaceParts = (place) =>
      [
        place?.neighborhood,
        place?.city,
        place?.regionCode || place?.region,
        place?.countryName || place?.country,
      ]
        .filter(hasValue)
        .join(", ");

    const formatCoordinatePair = (lat, lng) => {
      const latitude = toFiniteNumber(lat);
      const longitude = toFiniteNumber(lng);

      if (latitude === null || longitude === null) return "";

      return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    };

    const formatMeters = (value) => {
      const meters = toFiniteNumber(value);
      if (meters === null) return "";

      return meters >= 1000
        ? `${(meters / 1000).toFixed(1)} km`
        : `${Math.round(meters)} m`;
    };

    const formatKilometers = (value) => {
      const kilometers = toFiniteNumber(value);
      if (kilometers === null) return "";

      return kilometers >= 10
        ? `${Math.round(kilometers)} km`
        : `${kilometers.toFixed(1)} km`;
    };

    const distanceBetweenCoordinates = (a, b) => {
      const earthRadiusKm = 6371;
      const latA = (a.lat * Math.PI) / 180;
      const latB = (b.lat * Math.PI) / 180;
      const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
      const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;
      const haversine =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(latA) *
          Math.cos(latB) *
          Math.sin(deltaLng / 2) *
          Math.sin(deltaLng / 2);

      return (
        earthRadiusKm *
        2 *
        Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
      );
    };

    const nearestKnownBrowserPlace = (lat, lng) => {
      const nearest = nearbyBrowserPlaces
        .map((place) => ({
          ...place,
          distanceKm: distanceBetweenCoordinates({ lat, lng }, place),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)[0];

      return nearest?.distanceKm <= 90 ? nearest : null;
    };

    const placeFromBrowserLocation = (location, timezone) => {
      if (!location) return null;

      const lat = toFiniteNumber(location.lat);
      const lng = toFiniteNumber(location.lng);
      if (lat === null || lng === null) return null;

      const nearest = nearestKnownBrowserPlace(lat, lng);

      return {
        accuracy: location.accuracy,
        city: nearest?.city || "precise coordinates",
        country: nearest?.country,
        countryName: nearest?.countryName,
        lat,
        lng,
        neighborhood: nearest?.neighborhood,
        nearestDistanceKm: nearest?.distanceKm,
        region: nearest?.region,
        regionCode: nearest?.regionCode,
        source: "browser geolocation",
        timezone,
      };
    };

    const placeFromEdgeVisit = (visit) => {
      if (!visit) return null;

      const lat = toFiniteNumber(visit.lat ?? visit.latitude);
      const lng = toFiniteNumber(visit.lng ?? visit.longitude);
      if (lat === null || lng === null) return null;

      return {
        city: visit.city,
        country: visit.country,
        countryName: visit.countryName,
        lat,
        lng,
        postalCode: visit.postalCode,
        region: visit.region,
        regionCode: visit.regionCode,
        source: "edge IP geo",
        timezone: visit.timezone,
      };
    };

    const resolvePlace = (meta) =>
      placeFromBrowserLocation(meta.browserLocation, meta.timezone) ||
      placeFromEdgeVisit(meta.edgeVisit) ||
      getPlace(meta.timezone);

    const formatEdgeLocation = (visit) => formatPlaceParts(placeFromEdgeVisit(visit) || visit);

    const locationSourceLabel = (entry) => {
      const source = entry?.coordinateSource || entry?.place?.source;

      if (source === "browser geolocation") return "browser precision";
      if (source === "edge IP geo") return "edge IP geo";
      if (source === "timezone match") return "timezone fallback";

      return "source pending";
    };

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

    const normalizeEdgeVisit = (data) => {
      const visit = data?.visit || data;
      if (!visit || typeof visit !== "object") return null;

      return {
        asOrganization: readSafely(() => visit.asOrganization),
        asn: readSafely(() => visit.asn),
        city: readSafely(() => visit.city),
        country: readSafely(() => visit.country),
        countryName: readSafely(() => visit.countryName),
        ip: readSafely(() => visit.ip),
        lat: toFiniteNumber(visit.lat ?? visit.latitude),
        lng: toFiniteNumber(visit.lng ?? visit.longitude),
        metroCode: readSafely(() => visit.metroCode),
        postalCode: readSafely(() => visit.postalCode),
        region: readSafely(() => visit.region),
        regionCode: readSafely(() => visit.regionCode),
        requestTime: readSafely(() => visit.requestTime),
        timezone: readSafely(() => visit.timezone),
      };
    };

    const fetchEdgeVisit = async () => {
      if (!hasValue(visitorEndpoint)) return null;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2800);

      try {
        const response = await fetch(visitorEndpoint, {
          cache: "no-store",
          credentials: "omit",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`visitor endpoint ${response.status}`);

        const data = await response.json();
        return normalizeEdgeVisit(data);
      } catch (error) {
        console.warn("secret page edge visitor lookup failed", error);
        return null;
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const normalizeBrowserPosition = (position) => {
      const coords = position?.coords;
      if (!coords) return null;

      const lat = toFiniteNumber(coords.latitude);
      const lng = toFiniteNumber(coords.longitude);
      if (lat === null || lng === null) return null;

      return {
        accuracy: toFiniteNumber(coords.accuracy),
        lat,
        lng,
        timestamp: position.timestamp ? new Date(position.timestamp).toISOString() : "",
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
            accuracy: place.accuracy,
            city: place.city,
            country: place.country,
            countryName: place.countryName,
            lat: place.lat,
            lng: place.lng,
            neighborhood: place.neighborhood,
            nearestDistanceKm: place.nearestDistanceKm,
            postalCode: place.postalCode,
            region: place.region,
            regionCode: place.regionCode,
            source: place.source,
            timezone: place.timezone,
          }
        : null;

    const recordUnlock = (meta, { increment = true } = {}) => {
      const now = new Date();
      const browserId = getBrowserId();
      const place = resolvePlace(meta);
      const timezone = meta.timezone || place?.timezone || "unknown";
      const entries = getLog();
      const id = `${browserId}|${timezone}`;
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
        } else {
          delete existing.lat;
          delete existing.lng;
          existing.coordinateSource = "";
          existing.place = null;
        }
        existing.count = (Number(existing.count) || 0) + (increment ? 1 : 0);
        if (increment) {
          existing.lastLocalTime = meta.localTime;
          existing.lastIso = now.toISOString();
        }
        existing.timezone = timezone;
        existing.meta = meta;
      } else {
        activeEntry = {
          id,
          browserId,
          label: "you",
          timezone,
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
      const storedLat = toFiniteNumber(entry.place?.lat);
      const storedLng = toFiniteNumber(entry.place?.lng);
      const legacyLat = Array.isArray(legacyCoordinates)
        ? toFiniteNumber(legacyCoordinates[1])
        : null;
      const legacyLng = Array.isArray(legacyCoordinates)
        ? toFiniteNumber(legacyCoordinates[0])
        : null;
      const storedPlace =
        storedLat !== null && storedLng !== null
          ? {
              ...entry.place,
              lat: storedLat,
              lng: storedLng,
              source:
                entry.place.source ||
                entry.coordinateSource ||
                "stored coordinates",
            }
          : legacyLat !== null && legacyLng !== null
            ? {
                city: entry.place?.city,
                country: entry.place?.country,
                lat: legacyLat,
                lng: legacyLng,
                source: "timezone match",
                timezone: entry.timezone,
              }
            : null;
      const place = storedPlace || getPlace(entry.timezone);

      if (place) {
        return {
          ...entry,
          coordinateSource:
            place.source || entry.coordinateSource || "stored coordinates",
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
      if (entry?.kind === "sun") return "Sun overhead point";
      if (entry?.kind === "moon") return "Moon overhead point";

      const placeLabel = formatPlaceParts(entry?.place);
      if (placeLabel) {
        return placeLabel;
      }

      if (entry?.coordinateSource === "browser geolocation") {
        return "browser precise location";
      }

      if (entry?.timezone) {
        return `unmapped ${entry.timezone}`;
      }

      return "unknown signal";
    };

    const shortPlaceLabel = (entry) => {
      if (entry?.kind === "sun") return "subsolar";
      if (entry?.kind === "moon") return "sublunar";
      if (entry?.coordinateSource === "browser geolocation") return "precise";
      if (entry?.place?.city) return entry.place.city;
      if (!entry?.timezone) return "unknown";

      return entry.timezone.split("/").pop().replace(/_/g, " ");
    };

    const timezoneLabel = (entry) => {
      if (!entry?.timezone) return "timezone unavailable";

      const source = entry.coordinateSource || entry.place?.source;
      const coordinates = formatCoordinatePair(entry.lat, entry.lng);

      if (source === "browser geolocation") {
        return coordinates
          ? `${entry.timezone} timezone; ${coordinates}`
          : `${entry.timezone} timezone`;
      }

      return source
        ? `${entry.timezone} (${source})`
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

    const detailsForCelestialEntry = (entry) =>
      [
        ["body", entry.kind === "sun" ? "Sun" : "Moon"],
        ["view", entry.kind === "sun" ? "sun-centric subpoint" : "moon-centric subpoint"],
        ["overhead point", formatCoordinatePair(entry.lat, entry.lng)],
        ["latitude", formatCoordinate(entry.lat, "N", "S")],
        ["longitude", formatCoordinate(entry.lng, "E", "W")],
        ["phase", entry.phase],
        ["simulated UTC", entry.simulatedUtc],
      ].filter(([, value]) => hasValue(value));

    const detailsForEntry = (entry) => {
      if (entry?.kind === "sun" || entry?.kind === "moon") {
        return detailsForCelestialEntry(entry);
      }

      const meta = entry.meta || {};
      const edgeVisit = meta.edgeVisit || {};
      const browserLocation = meta.browserLocation || {};
      return [
        ["where", whereLabel(entry)],
        ["source", locationSourceLabel(entry)],
        ["timezone", timezoneLabel(entry)],
        ["nearest known place", formatPlaceParts(entry.place)],
        ["nearest place distance", formatKilometers(entry.place?.nearestDistanceKm)],
        ["ip", edgeVisit.ip],
        ["edge location", formatEdgeLocation(edgeVisit)],
        [
          "edge coordinates",
          formatCoordinatePair(edgeVisit.lat ?? edgeVisit.latitude, edgeVisit.lng ?? edgeVisit.longitude),
        ],
        ["edge observed", edgeVisit.requestTime],
        ["ASN", edgeVisit.asn],
        ["network", edgeVisit.asOrganization],
        [
          "browser coordinates",
          formatCoordinatePair(browserLocation.lat, browserLocation.lng),
        ],
        ["browser accuracy", formatMeters(browserLocation.accuracy)],
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
      const edgeVisit = entry?.meta?.edgeVisit || {};
      setText(mapPlace, whereLabel(entry));
      setText(mapTimezone, timezoneLabel(entry));
      setText(mapTime, entry?.lastLocalTime);
      setText(mapIp, edgeVisit.ip);
      setText(mapEdgeLocation, formatEdgeLocation(edgeVisit));
      setText(mapCount, formatUnlockCount(entry?.browserUnlockCount || entry?.count));
      setText(locationSource, locationSourceLabel(entry));
      setText(networkAsn, edgeVisit.asn);
      setText(networkObserved, edgeVisit.requestTime);
      setText(streetCenter, formatCoordinatePair(entry?.lat, entry?.lng));
      setText(streetAccuracy, formatMeters(entry?.meta?.browserLocation?.accuracy));
      setText(streetModeLabel, activeViewMode === "street" ? "synced street map" : "globe context");
      if (sharpenLocationButton) {
        const hasBrowserPrecision = entry?.coordinateSource === "browser geolocation";
        sharpenLocationButton.hidden = !navigator.geolocation || hasBrowserPrecision;
      }
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
        .querySelectorAll(".sirui-map-marker-group, .sirui-globe-marker, .sirui-celestial-marker")
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

    const clamp = (value, min, max) =>
      Math.max(min, Math.min(max, Number(value) || 0));

    const globeMarkerScale = () =>
      clamp(0.82 + ((currentGlobeAltitude - 1.2) / 2.5) * 0.23, 0.82, 1.05);

    const pointRadiusForEntry = (entry) => {
      const countBoost = Math.min(Number(entry?.count) || 1, 8) * 0.004;
      const baseRadius = entry?.isCurrent ? 0.072 : 0.046;

      return (baseRadius + countBoost) * globeMarkerScale();
    };

    const refreshGlobeMarkerScale = () => {
      if (!globeInstance) return;

      const scale = globeMarkerScale();
      globeInstance.pointRadius?.(pointRadiusForEntry);
      globeInstance.ringMaxRadius?.(activeViewMode === "street" ? 0.95 : 0.9 + scale * 1.28);
      globeInstance.ringPropagationSpeed?.(
        prefersReducedMotion.matches ? 0 : 0.28 + scale * 0.28,
      );
    };

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

    const waitForLeaflet = () =>
      new Promise((resolve) => {
        if (window.L?.map) {
          resolve(window.L);
          return;
        }

        const started = Date.now();
        const interval = window.setInterval(() => {
          if (window.L?.map) {
            window.clearInterval(interval);
            resolve(window.L);
          } else if (Date.now() - started > 3000) {
            window.clearInterval(interval);
            resolve(null);
          }
        }, 60);
      });

    const fitConsoleToViewport = () => {
      if (!map || map.hidden) return;

      const height = clamp(window.innerHeight - 270, 340, 720);
      map.style.setProperty("--sirui-stage-height", `${Math.round(height)}px`);
      window.requestAnimationFrame(() => {
        resizeGlobe();
        streetMapInstance?.invalidateSize?.(false);
      });
    };

    const normalizeLongitude = (longitude) =>
      ((((Number(longitude) || 0) + 540) % 360) + 360) % 360 - 180;

    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const toDegrees = (radians) => (radians * 180) / Math.PI;

    const getJulianDate = (date) => date.getTime() / 86400000 + 2440587.5;

    const getGreenwichSiderealTime = (date) => {
      const jd = getJulianDate(date);
      const centuries = (jd - 2451545) / 36525;

      return normalizeLongitude(
        280.46061837 +
          360.98564736629 * (jd - 2451545) +
          0.000387933 * centuries * centuries -
          (centuries * centuries * centuries) / 38710000,
      );
    };

    const getSubpointFromRightAscension = (date, rightAscension, declination) => ({
      lat: declination,
      lng: normalizeLongitude(rightAscension - getGreenwichSiderealTime(date)),
    });

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

    const getSubsolarPointPrecise = (date = new Date()) => {
      const jd = getJulianDate(date);
      const days = jd - 2451545;
      const meanLongitude = normalizeLongitude(280.460 + 0.9856474 * days);
      const meanAnomaly = normalizeLongitude(357.528 + 0.9856003 * days);
      const eclipticLongitude =
        meanLongitude +
        1.915 * Math.sin(toRadians(meanAnomaly)) +
        0.02 * Math.sin(toRadians(2 * meanAnomaly));
      const obliquity = 23.439 - 0.0000004 * days;
      const rightAscension = normalizeLongitude(
        toDegrees(
          Math.atan2(
            Math.cos(toRadians(obliquity)) *
              Math.sin(toRadians(eclipticLongitude)),
            Math.cos(toRadians(eclipticLongitude)),
          ),
        ),
      );
      const declination = toDegrees(
        Math.asin(
          Math.sin(toRadians(obliquity)) *
            Math.sin(toRadians(eclipticLongitude)),
        ),
      );

      return getSubpointFromRightAscension(date, rightAscension, declination);
    };

    const getSublunarPoint = (date = new Date()) => {
      const jd = getJulianDate(date);
      const days = jd - 2451543.5;
      const ascendingNode = normalizeLongitude(
        125.1228 - 0.0529538083 * days,
      );
      const inclination = 5.1454;
      const argumentOfPerigee = normalizeLongitude(
        318.0634 + 0.1643573223 * days,
      );
      const eccentricity = 0.0549;
      const meanAnomaly = normalizeLongitude(115.3654 + 13.0649929509 * days);
      const eccentricAnomaly =
        meanAnomaly +
        toDegrees(eccentricity * Math.sin(toRadians(meanAnomaly))) *
          (1 + eccentricity * Math.cos(toRadians(meanAnomaly)));
      const xv = Math.cos(toRadians(eccentricAnomaly)) - eccentricity;
      const yv =
        Math.sqrt(1 - eccentricity * eccentricity) *
        Math.sin(toRadians(eccentricAnomaly));
      const trueAnomaly = toDegrees(Math.atan2(yv, xv));
      const radius = Math.sqrt(xv * xv + yv * yv);
      const nodeRadians = toRadians(ascendingNode);
      const orbitalAngle = toRadians(trueAnomaly + argumentOfPerigee);
      const inclinationRadians = toRadians(inclination);
      const xEcliptic =
        radius *
        (Math.cos(nodeRadians) * Math.cos(orbitalAngle) -
          Math.sin(nodeRadians) *
            Math.sin(orbitalAngle) *
            Math.cos(inclinationRadians));
      const yEcliptic =
        radius *
        (Math.sin(nodeRadians) * Math.cos(orbitalAngle) +
          Math.cos(nodeRadians) *
            Math.sin(orbitalAngle) *
            Math.cos(inclinationRadians));
      const zEcliptic =
        radius * Math.sin(orbitalAngle) * Math.sin(inclinationRadians);
      const obliquity = toRadians(23.4393 - 0.0000004 * (jd - 2451545));
      const xEquatorial = xEcliptic;
      const yEquatorial =
        yEcliptic * Math.cos(obliquity) - zEcliptic * Math.sin(obliquity);
      const zEquatorial =
        yEcliptic * Math.sin(obliquity) + zEcliptic * Math.cos(obliquity);
      const rightAscension = normalizeLongitude(
        toDegrees(Math.atan2(yEquatorial, xEquatorial)),
      );
      const declination = toDegrees(
        Math.atan2(
          zEquatorial,
          Math.sqrt(xEquatorial * xEquatorial + yEquatorial * yEquatorial),
        ),
      );

      return getSubpointFromRightAscension(date, rightAscension, declination);
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
      const point = getSubsolarPointPrecise(date);

      return {
        id: "sun-track",
        kind: "sun",
        label: "subsolar",
        lat: point.lat,
        lng: point.lng,
        simulatedUtc: date.toISOString().replace("T", " ").slice(0, 16),
      };
    };

    const makeMoonEntry = (date = new Date()) => {
      const point = getSublunarPoint(date);
      const phase = getMoonPhase(date);

      return {
        id: "moon-track",
        kind: "moon",
        label: "sublunar",
        lat: point.lat,
        lng: point.lng,
        phase: phase.label,
        phaseIllumination: phase.illumination,
        simulatedUtc: date.toISOString().replace("T", " ").slice(0, 16),
      };
    };

    const latLngToUnit = ({ lat, lng }) => {
      const latRadians = toRadians(lat);
      const lngRadians = toRadians(lng);

      return {
        x: Math.cos(latRadians) * Math.cos(lngRadians),
        y: Math.cos(latRadians) * Math.sin(lngRadians),
        z: Math.sin(latRadians),
      };
    };

    const cross = (a, b) => ({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    });

    const normalizeVector = (vector) => {
      const length =
        Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z) ||
        1;

      return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length,
      };
    };

    const unitToLatLng = (vector) => ({
      lat: toDegrees(Math.asin(Math.max(-1, Math.min(1, vector.z)))),
      lng: normalizeLongitude(toDegrees(Math.atan2(vector.y, vector.x))),
    });

    const buildTerminatorPath = (sunPosition) => {
      const sun = latLngToUnit(sunPosition);
      const reference = Math.abs(sun.z) > 0.92 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
      const axisA = normalizeVector(cross(sun, reference));
      const axisB = normalizeVector(cross(sun, axisA));
      const points = [];

      for (let index = 0; index <= 240; index += 1) {
        const angle = (index / 240) * Math.PI * 2;
        const point = unitToLatLng({
          x: Math.cos(angle) * axisA.x + Math.sin(angle) * axisB.x,
          y: Math.cos(angle) * axisA.y + Math.sin(angle) * axisB.y,
          z: Math.cos(angle) * axisA.z + Math.sin(angle) * axisB.z,
        });

        points.push({ ...point, alt: 0.018 });
      }

      return points;
    };

    const buildMoonGroundTrack = (date) => {
      const points = [];

      for (let index = -24; index <= 24; index += 1) {
        const point = getSublunarPoint(
          new Date(date.getTime() + index * 60 * 60 * 1000),
        );

        points.push({ ...point, alt: 0.024 });
      }

      return points;
    };

    const geometricGridPaths = (() => {
      const paths = [];

      for (let lat = -60; lat <= 60; lat += 30) {
        const points = [];
        for (let lng = -180; lng <= 180; lng += 6) {
          points.push({ alt: 0.012, lat, lng });
        }
        paths.push({
          color: "rgba(112, 216, 255, 0.11)",
          dashGap: 0,
          dashLength: 0,
          name: "geometric latitude line",
          points,
          stroke: lat === 0 ? 0.22 : 0.14,
        });
      }

      for (let lng = -150; lng <= 180; lng += 30) {
        const points = [];
        for (let lat = -84; lat <= 84; lat += 6) {
          points.push({ alt: 0.012, lat, lng: normalizeLongitude(lng) });
        }
        paths.push({
          color: "rgba(142, 234, 98, 0.075)",
          dashGap: 0,
          dashLength: 0,
          name: "geometric longitude line",
          points,
          stroke: 0.12,
        });
      }

      return paths;
    })();

    const buildCelestialPaths = (date, sunPosition) => [
      ...geometricGridPaths,
      {
        color: "rgba(112, 216, 255, 0.2)",
        dashGap: 0,
        dashLength: 0,
        name: "soft terminator glow",
        points: buildTerminatorPath(sunPosition),
        stroke: 0.72,
      },
      {
        color: "rgba(255, 184, 86, 0.3)",
        dashGap: 0,
        dashLength: 0,
        name: "sunrise sunset edge",
        points: buildTerminatorPath(sunPosition),
        stroke: 0.28,
      },
      {
        animateTime: 0,
        color: "rgba(220, 235, 255, 0.2)",
        dashGap: 0,
        dashLength: 0,
        name: "moon ground track",
        points: buildMoonGroundTrack(date),
        stroke: 0.18,
      },
    ];

    const getSimulatedDate = () => {
      if (celestialSpeed === 0) return new Date(celestialBaseSimTime);

      const elapsed = Date.now() - celestialBaseRealTime;
      return new Date(celestialBaseSimTime + elapsed * celestialSpeed);
    };

    const setCelestialMode = (mode) => {
      const current = getSimulatedDate().getTime();
      celestialMode = mode;
      celestialBaseRealTime = Date.now();
      celestialBaseSimTime = current;
      celestialSpeed = mode === "fast" ? 90 : mode === "realtime" ? 1 : 0;
      if (prefersReducedMotion.matches && mode === "fast") {
        celestialSpeed = 0;
        celestialMode = "pause";
      }

      timeModeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.siruiTimeMode === celestialMode);
      });
    };

    const stepCelestialHours = (hours) => {
      celestialBaseSimTime = getSimulatedDate().getTime() + hours * 60 * 60 * 1000;
      celestialBaseRealTime = Date.now();
      celestialSpeed = 0;
      celestialMode = "pause";
      setCelestialMode("pause");
      updateSunSystemOnce();
    };

    const getMoonPhase = (date) => {
      const cycle = 29.530588853;
      const age = (((getJulianDate(date) - 2451550.1) % cycle) + cycle) % cycle;
      const illumination = (1 - Math.cos((2 * Math.PI * age) / cycle)) / 2;
      const names = [
        [1.84566, "new moon"],
        [5.53699, "waxing crescent"],
        [9.22831, "first quarter"],
        [12.91963, "waxing gibbous"],
        [16.61096, "full moon"],
        [20.30228, "waning gibbous"],
        [23.99361, "last quarter"],
        [27.68493, "waning crescent"],
        [cycle, "new moon"],
      ];
      const name = names.find(([limit]) => age < limit)?.[1] || "moon phase";

      return {
        age,
        illumination,
        label: `${name}, ${Math.round(illumination * 100)}% lit`,
      };
    };

    const updateSunHud = (date, sunPosition, moonPosition) => {
      if (sunUtc) {
        sunUtc.textContent = `UTC ${date.toISOString().slice(11, 16)}`;
      }

      if (orbitClock) {
        orbitClock.textContent =
          celestialSpeed === 0
            ? "paused"
            : celestialSpeed === 1
              ? "real time"
              : `${celestialSpeed}x sky`;
      }

      if (sunPoint) {
        sunPoint.textContent = `sun ${formatCoordinate(sunPosition.lat, "N", "S")}, ${formatCoordinate(sunPosition.lng, "E", "W")}`;
      }

      if (moonPoint) {
        moonPoint.textContent = `moon ${formatCoordinate(moonPosition.lat, "N", "S")}, ${formatCoordinate(moonPosition.lng, "E", "W")}`;
      }
    };

    const updateSkyCockpit = ({ date, sunEntry, moonEntry, moonPhase }) => {
      const activeCelestial =
        activeViewMode === "moon" ? moonEntry : activeViewMode === "sun" ? sunEntry : null;
      const summary = `Sun ${formatCoordinate(sunEntry.lat, "N", "S")}, ${formatCoordinate(sunEntry.lng, "E", "W")} - Moon ${formatCoordinate(moonEntry.lat, "N", "S")}, ${formatCoordinate(moonEntry.lng, "E", "W")}`;
      const clockLabel =
        celestialSpeed === 0
          ? "paused"
          : celestialSpeed === 1
            ? "realtime"
            : `${celestialSpeed}x`;

      setText(skyInfoUtc, date.toISOString().slice(11, 19));
      setText(skyInfoClock, clockLabel);
      setText(skyInfoSummary, summary);

      if (!skyPanel) return;

      const showSky = ["sun", "moon", "orbit"].includes(activeViewMode);
      skyPanel.hidden = !showSky;
      if (!showSky) return;

      const modeLabel =
        activeViewMode === "sun"
          ? "sun view"
          : activeViewMode === "moon"
            ? "moon view"
            : "orbit view";
      setText(skyMode, modeLabel);
      setText(
        skyTitle,
        activeViewMode === "sun"
          ? "Subsolar cockpit"
          : activeViewMode === "moon"
            ? "Sublunar cockpit"
            : "Stylized Earth-Moon scale",
      );
      setText(
        skySubpoint,
        activeCelestial
          ? formatCoordinatePair(activeCelestial.lat, activeCelestial.lng)
          : summary,
      );
      setText(skyPhase, moonPhase.label);
      setText(
        skyScale,
        activeViewMode === "orbit"
          ? "Moon drawn at 0.273x Earth radius; distance cinematic."
          : "Earth subpoint view; bodies shown in sky overlay.",
      );
      setText(skyInfoTitle, modeLabel);
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
        material.bumpScale = 5;
        material.shininess = 16;
        material.color?.set?.("#ffffff");
        material.emissive?.set?.("#06110d");
        material.emissiveIntensity = 0.1;
        material.needsUpdate = true;
      }

      const lights = globe.lights?.();
      if (Array.isArray(lights)) {
        lights.forEach((light) => {
          if (light.type === "AmbientLight") light.intensity = 0.62;
          if (light.type === "DirectionalLight") light.intensity = 1.08;
        });
      }
    };

    const updateSunlight = (globe, date = new Date()) => {
      const point = getSubsolarPointPrecise(date);
      const vector = sunVector(point);
      const lights = globe.lights?.();
      const directional = Array.isArray(lights)
        ? lights.find((light) => light.type === "DirectionalLight")
        : null;

      if (directional?.position?.set) {
        directional.position.set(vector.x, vector.y, vector.z);
      }

      return point;
    };

    const configureCelestialPaths = (globe, reducedMotion) => {
      if (typeof globe.pathsData !== "function") return;

      globe.pathsData([]);
      globe.pathPoints?.("points");
      globe.pathPointLat?.("lat");
      globe.pathPointLng?.("lng");
      globe.pathPointAlt?.("alt");
      globe.pathResolution?.(0.85);
      globe.pathColor?.((path) => path.color);
      globe.pathStroke?.((path) => path.stroke);
      globe.pathDashLength?.((path) => path.dashLength);
      globe.pathDashGap?.((path) => path.dashGap);
      globe.pathDashAnimateTime?.((path) =>
        reducedMotion ? 0 : path.animateTime || 0,
      );
      globe.pathTransitionDuration?.(reducedMotion ? 0 : 700);
    };

    const stopSunTimer = () => {
      if (sunTimer) {
        window.clearInterval(sunTimer);
        sunTimer = null;
      }
    };

    const updateSunSystemOnce = () => {
      if (!globeInstance) return;

      const date = getSimulatedDate();
      const sunEntry = makeSunEntry(date);
      const moonEntry = makeMoonEntry(date);
      const sunPosition = updateSunlight(globeInstance, date);
      const moonPosition = {
        lat: moonEntry.lat,
        lng: moonEntry.lng,
      };
      const moonPhase = getMoonPhase(date);
      const baseEntries = currentGlobeEntries;

      lastSkySnapshot = { date, moonEntry, moonPhase, sunEntry };
      updateSunHud(date, sunPosition, moonPosition);
      updateSkyCockpit({ date, moonEntry, moonPhase, sunEntry });
      globeInstance.htmlElementsData([...baseEntries, sunEntry, moonEntry]);
      globeInstance.pathsData?.(buildCelestialPaths(date, sunPosition));

      if (activeViewMode === "sun") {
        focusedGlobeEntry = sunEntry;
      } else if (activeViewMode === "moon") {
        focusedGlobeEntry = moonEntry;
      }

      if (detailsPinned && activeMarkerId === sunEntry.id) {
        showMarkerDetails(sunEntry, { pinned: true });
      } else if (detailsPinned && activeMarkerId === moonEntry.id) {
        showMarkerDetails(moonEntry, { pinned: true });
      }
      window.requestAnimationFrame(() => setActiveMarker(activeMarkerId));
    };

    const startSunSystem = () => {
      stopSunTimer();
      celestialBaseRealTime = Date.now();

      updateSunSystemOnce();

      if (!prefersReducedMotion.matches) {
        sunTimer = window.setInterval(updateSunSystemOnce, 1500);
      }
    };

    const focusCelestial = (entry) => {
      if (!entry || !hasCoordinates(entry)) return;

      setViewMode(entry.kind, { animate: true });
    };

    const createGlobeMarker = (entry) => {
      if (entry.kind === "sun" || entry.kind === "moon") {
        const marker = document.createElement("button");
        const core = document.createElement("span");
        const label = document.createElement("span");

        marker.type = "button";
        marker.className = `sirui-celestial-marker is-${entry.kind}`;
        marker.dataset.entryId = entry.id;
        marker.setAttribute("aria-label", `${entry.kind}-centric view for ${whereLabel(entry)}`);
        core.className = "sirui-celestial-core";
        label.className = "sirui-celestial-label";
        label.textContent = entry.label;
        marker.append(core, label);

        marker.addEventListener("mouseenter", () => previewMarker(entry));
        marker.addEventListener("mouseleave", clearMarkerPreview);
        marker.addEventListener("focus", () => showMarkerDetails(entry));
        marker.addEventListener("blur", hideMarkerDetails);
        marker.addEventListener("click", (event) => {
          event.stopPropagation();
          focusCelestial(entry);
        });

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
        focusedGlobeEntry = entry;
        if (activeViewMode !== "visitor") {
          setViewMode("visitor");
        }
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
        .slice(0, 4)
        .map((entry) => ({
          endLat: activeEntry.lat,
          endLng: activeEntry.lng,
          name: "local unlock trail",
          startLat: entry.lat,
          startLng: entry.lng,
        }));
    };

    const streetZoomRangeForEntry = (entry) => {
      if (entry?.coordinateSource === "browser geolocation") return [15, 19];
      if (entry?.coordinateSource === "edge IP geo") return [10, 13];
      return [4, 7];
    };

    const altitudeToStreetZoom = (altitude, entry) => {
      const [minZoom, maxZoom] = streetZoomRangeForEntry(entry);
      const progress = clamp((2.65 - altitude) / (2.65 - 0.82), 0, 1);

      return Math.round(minZoom + progress * (maxZoom - minZoom));
    };

    const streetZoomToAltitude = (zoom, entry) => {
      const [minZoom, maxZoom] = streetZoomRangeForEntry(entry);
      const progress = clamp((zoom - minZoom) / Math.max(maxZoom - minZoom, 1), 0, 1);

      return 2.65 - progress * (2.65 - 0.82);
    };

    const updateStreetReadout = (entry) => {
      const zoom = streetMapInstance?.getZoom?.();
      const center = streetMapInstance?.getCenter?.();

      setText(streetModeLabel, activeViewMode === "street" ? "synced street map" : "globe context");
      setText(streetZoomReadout, Number.isFinite(zoom) ? `z${zoom}` : "");
      setText(
        streetCenter,
        center
          ? formatCoordinatePair(center.lat, center.lng)
          : formatCoordinatePair(entry?.lat, entry?.lng),
      );
      setText(streetAccuracy, formatMeters(entry?.meta?.browserLocation?.accuracy));
    };

    const updateStreetMarker = (entry) => {
      if (!streetMapInstance || !window.L || !hasCoordinates(entry)) return;

      const latLng = [Number(entry.lat), Number(entry.lng)];
      if (!streetMarker) {
        streetMarker = window.L.marker(latLng, {
          icon: window.L.divIcon({
            className: "sirui-street-pin-wrap",
            html: '<span class="sirui-street-pin"></span>',
            iconAnchor: [7, 7],
            iconSize: [14, 14],
          }),
          keyboard: false,
        }).addTo(streetMapInstance);
      } else {
        streetMarker.setLatLng(latLng);
      }

      const accuracy = toFiniteNumber(entry?.meta?.browserLocation?.accuracy);
      if (accuracy !== null) {
        if (!streetAccuracyCircle) {
          streetAccuracyCircle = window.L.circle(latLng, {
            className: "sirui-street-accuracy",
            color: "#ff4f9a",
            fillColor: "#ff4f9a",
            fillOpacity: 0.08,
            opacity: 0.42,
            radius: accuracy,
            weight: 1.5,
          }).addTo(streetMapInstance);
        } else {
          streetAccuracyCircle.setLatLng(latLng);
          streetAccuracyCircle.setRadius(accuracy);
        }
      } else if (streetAccuracyCircle) {
        streetAccuracyCircle.remove();
        streetAccuracyCircle = null;
      }
    };

    const ensureStreetMap = async (entry) => {
      if (!streetMapElement || !hasCoordinates(entry)) return null;

      const L = await waitForLeaflet();
      if (!L) return null;

      if (!streetMapInstance) {
        streetMapInstance = L.map(streetMapElement, {
          attributionControl: true,
          keyboard: false,
          scrollWheelZoom: true,
          zoomControl: false,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(streetMapInstance);
        L.control.zoom({ position: "bottomright" }).addTo(streetMapInstance);
        streetMapInstance.on("moveend zoomend", () => {
          if (streetSyncLocked || !globeInstance || !focusedGlobeEntry) return;
          if (activeViewMode !== "street") return;

          const center = streetMapInstance.getCenter();
          const zoom = streetMapInstance.getZoom();
          globeSyncLocked = true;
          globeInstance.pointOfView(
            {
              altitude: streetZoomToAltitude(zoom, focusedGlobeEntry),
              lat: center.lat,
              lng: center.lng,
            },
            0,
          );
          window.setTimeout(() => {
            globeSyncLocked = false;
          }, 0);
          updateStreetReadout(focusedGlobeEntry);
        });
      }

      updateStreetMarker(entry);
      return streetMapInstance;
    };

    const syncStreetMapFromGlobe = async (entry, pov, { force = false } = {}) => {
      if (!hasCoordinates(entry) || entry?.kind || activeViewMode !== "street") return;

      const streetMap = await ensureStreetMap(entry);
      if (!streetMap) return;

      const centerLat = toFiniteNumber(pov?.lat) ?? Number(entry.lat);
      const centerLng = toFiniteNumber(pov?.lng) ?? Number(entry.lng);
      const zoom = altitudeToStreetZoom(Number(pov?.altitude) || currentGlobeAltitude, entry);
      streetMapTitle.textContent = whereLabel(entry);
      streetMapPanel.hidden = false;
      streetSyncLocked = true;
      if (force) {
        streetMap.setView([centerLat, centerLng], zoom, {
          animate: !prefersReducedMotion.matches,
        });
      } else {
        streetMap.setView([centerLat, centerLng], zoom, {
          animate: false,
        });
      }
      window.setTimeout(() => {
        streetSyncLocked = false;
      }, force ? 450 : 80);
      streetMap.invalidateSize(false);
      updateStreetReadout(entry);
    };

    const setStreetMapVisible = (visible) => {
      if (streetMapPanel) streetMapPanel.hidden = !visible;
      mapStage?.classList.toggle("is-street-mode", visible);
      window.requestAnimationFrame(() => {
        streetMapInstance?.invalidateSize?.(false);
        resizeGlobe();
      });
    };

    const applyZoomMode = (pov, activeEntry) => {
      const altitude = Number(pov?.altitude) || 2.4;
      const isFar = altitude > 2.35;
      const isNear = altitude <= 1.42;
      const focusEntry = focusedGlobeEntry || activeEntry;

      currentGlobeAltitude = altitude;
      mapStage?.classList.toggle("is-zoom-far", isFar);
      mapStage?.classList.toggle("is-zoom-mid", !isFar && !isNear);
      mapStage?.classList.toggle("is-zoom-near", isNear);
      refreshGlobeMarkerScale();
      if (activeViewMode === "street" && !globeSyncLocked) {
        void syncStreetMapFromGlobe(focusEntry, {
          altitude,
          lat: pov?.lat ?? focusEntry?.lat,
          lng: pov?.lng ?? focusEntry?.lng,
        });
      }

      if (isNear && hasCoordinates(focusEntry) && !detailsPinned) {
        showMarkerDetails(focusEntry);
      } else if (!detailsPinned && !isNear) {
        hideMarkerDetails();
      }
    };

    const activeVisitorEntry = () => {
      const entry = lastUnlockRecord?.activeEntry || focusedGlobeEntry;
      return entry ? normalizeEntry(entry) : null;
    };

    const setViewMode = (mode, { animate = true } = {}) => {
      const visitorEntry = activeVisitorEntry();
      if (!visitorEntry && !["sun", "moon", "orbit"].includes(mode)) return;

      activeViewMode = mode;
      viewModeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.siruiView === mode);
      });

      const transitionMs = prefersReducedMotion.matches || !animate ? 0 : 900;
      const skySnapshot =
        lastSkySnapshot || {
          date: getSimulatedDate(),
          moonEntry: makeMoonEntry(getSimulatedDate()),
          moonPhase: getMoonPhase(getSimulatedDate()),
          sunEntry: makeSunEntry(getSimulatedDate()),
        };

      setStreetMapVisible(mode === "street");
      mapStage?.classList.toggle("is-sky-mode", ["sun", "moon", "orbit"].includes(mode));
      if (mode !== "street") updateStreetReadout(visitorEntry);

      if (mode === "visitor" && visitorEntry) {
        focusedGlobeEntry = visitorEntry;
        clearPinnedDetails();
        skyPanel.hidden = true;
        globeInstance?.pointOfView(
          {
            altitude: 2.35,
            lat: visitorEntry.lat,
            lng: visitorEntry.lng,
          },
          transitionMs,
        );
        setGlobeStatus(`Visitor view centered near ${whereLabel(visitorEntry)}.`);
      } else if (mode === "street" && visitorEntry) {
        focusedGlobeEntry = visitorEntry;
        skyPanel.hidden = true;
        showMarkerDetails(visitorEntry, { pinned: true });
        globeInstance?.pointOfView(
          {
            altitude: 1.05,
            lat: visitorEntry.lat,
            lng: visitorEntry.lng,
          },
          transitionMs,
        );
        void syncStreetMapFromGlobe(
          visitorEntry,
          {
            altitude: 1.05,
            lat: visitorEntry.lat,
            lng: visitorEntry.lng,
          },
          { force: true },
        );
        setGlobeStatus(`Street view synced near ${whereLabel(visitorEntry)}.`);
      } else if (mode === "sun") {
        focusedGlobeEntry = skySnapshot.sunEntry;
        showMarkerDetails(skySnapshot.sunEntry, { pinned: true });
        updateSkyCockpit(skySnapshot);
        globeInstance?.pointOfView(
          {
            altitude: 1.55,
            lat: skySnapshot.sunEntry.lat,
            lng: skySnapshot.sunEntry.lng,
          },
          transitionMs,
        );
        setGlobeStatus("Sun cockpit facing the subsolar point.");
      } else if (mode === "moon") {
        focusedGlobeEntry = skySnapshot.moonEntry;
        showMarkerDetails(skySnapshot.moonEntry, { pinned: true });
        updateSkyCockpit(skySnapshot);
        globeInstance?.pointOfView(
          {
            altitude: 1.55,
            lat: skySnapshot.moonEntry.lat,
            lng: skySnapshot.moonEntry.lng,
          },
          transitionMs,
        );
        setGlobeStatus("Moon cockpit facing the sublunar point.");
      } else if (mode === "orbit") {
        focusedGlobeEntry = visitorEntry || skySnapshot.sunEntry;
        clearPinnedDetails();
        updateSkyCockpit(skySnapshot);
        globeInstance?.pointOfView(
          {
            altitude: 3.05,
            lat: visitorEntry?.lat || 0,
            lng: visitorEntry?.lng || 0,
          },
          transitionMs,
        );
        setGlobeStatus("Orbit view showing a stylized Earth-Moon scale cue.");
      }

      updateStreetReadout(visitorEntry);
      window.requestAnimationFrame(resizeGlobe);
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
        currentGlobeEntries = entries;
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
          .atmosphereAltitude(0.13)
          .globeCurvatureResolution(1.15)
          .pointsData(entries)
          .pointLat("lat")
          .pointLng("lng")
          .pointAltitude((entry) => (entry.isCurrent ? 0.08 : 0.035))
          .pointRadius(pointRadiusForEntry)
          .pointResolution(24)
          .pointColor((entry) => (entry.isCurrent ? "#ff4f9a" : "#8eea62"))
          .pointLabel((entry) => whereLabel(entry))
          .pointsTransitionDuration(reducedMotion ? 0 : 700)
          .ringsData(activePoint ? [activePoint] : [])
          .ringLat("lat")
          .ringLng("lng")
          .ringAltitude(0.012)
          .ringColor(() => "rgba(255, 79, 154, 0.42)")
          .ringMaxRadius(2.2)
          .ringPropagationSpeed(reducedMotion ? 0 : 0.48)
          .ringRepeatPeriod(reducedMotion ? 0 : 3200)
          .ringResolution(96)
          .arcsData(buildUnlockArcs(entries, activeEntry))
          .arcLabel("name")
          .arcStartLat("startLat")
          .arcStartLng("startLng")
          .arcEndLat("endLat")
          .arcEndLng("endLng")
          .arcColor(() => ["rgba(112, 216, 255, 0.08)", "rgba(255, 79, 154, 0.32)"])
          .arcAltitudeAutoScale(0.2)
          .arcCurveResolution(96)
          .arcCircularResolution(8)
          .arcDashLength(1)
          .arcDashGap(0)
          .arcDashAnimateTime(0)
          .arcStroke(0.16)
          .htmlElementsData(entries)
          .htmlLat("lat")
          .htmlLng("lng")
          .htmlAltitude((entry) => (entry.kind ? 0.16 : 0.09))
          .htmlElement(createGlobeMarker)
          .htmlTransitionDuration(reducedMotion ? 0 : 700)
          .htmlElementVisibilityModifier((element, isVisible) => {
            if (element.classList.contains("sirui-celestial-marker")) {
              element.style.opacity = isVisible ? "" : "0";
              element.style.pointerEvents = isVisible ? "auto" : "none";
              element.tabIndex = isVisible ? 0 : -1;
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
        configureCelestialPaths(globe, reducedMotion);

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

        startSunSystem();

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
      setStreetMapVisible(false);
      focusedGlobeEntry = normalizedActive;

      map.hidden = false;
      fitConsoleToViewport();

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

      setViewMode(activeViewMode, { animate: false });
    };

    const setSharpenButtonText = (text) => {
      if (sharpenLocationButton) sharpenLocationButton.textContent = text;
    };

    const readGeolocationPermissionState = async () => {
      if (!navigator.permissions?.query) return "";

      try {
        const status = await navigator.permissions.query({
          name: "geolocation",
        });
        return status.state;
      } catch {
        return "";
      }
    };

    const getBrowserPosition = () =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("geolocation unavailable"));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 60000,
          timeout: 10000,
        });
      });

    const applyBrowserPosition = async (position) => {
      const browserLocation = normalizeBrowserPosition(position);
      if (!browserLocation) throw new Error("missing browser coordinates");

      const meta = {
        ...(lastUnlockRecord.activeEntry.meta || {}),
        browserLocation,
      };
      const unlockRecord = recordUnlock(meta, { increment: false });
      lastUnlockRecord = unlockRecord;

      await renderMap(unlockRecord.entries, unlockRecord.activeEntry);
      showMarkerDetails(normalizeEntry(unlockRecord.activeEntry), {
        pinned: true,
      });
    };

    const requestBrowserPrecision = async ({ automatic = false } = {}) => {
      if (!lastUnlockRecord?.activeEntry || browserPrecisionRequestInFlight) return;

      browserPrecisionRequestInFlight = true;
      if (sharpenLocationButton) sharpenLocationButton.disabled = true;
      if (!automatic && sharpenLocationButton) sharpenLocationButton.hidden = false;
      setSharpenButtonText("locating...");
      setText(locationSource, "checking browser precision");

      try {
        const position = await getBrowserPosition();
        await applyBrowserPosition(position);
        setSharpenButtonText("location sharpened");
      } catch (error) {
        console.warn("secret page browser location failed", error);
        setSharpenButtonText("retry precise location");
        setText(locationSource, "browser precision unavailable");
      } finally {
        browserPrecisionRequestInFlight = false;
        if (sharpenLocationButton) sharpenLocationButton.disabled = false;
      }
    };

    const autoSharpenLocation = async () => {
      if (!navigator.geolocation || !lastUnlockRecord?.activeEntry) return;
      if (lastUnlockRecord.activeEntry.coordinateSource === "browser geolocation") return;

      const permissionState = await readGeolocationPermissionState();
      if (permissionState === "denied") {
        setText(locationSource, "browser precision blocked");
        setSharpenButtonText("retry precise location");
        if (sharpenLocationButton) sharpenLocationButton.hidden = false;
        return;
      }

      await requestBrowserPrecision({ automatic: true });
    };

    const sharpenLocation = () => requestBrowserPrecision();

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
        const edgeVisit = await fetchEdgeVisit();
        if (edgeVisit) {
          visitorMeta.edgeVisit = edgeVisit;
          visitorMeta.timezone = visitorMeta.timezone || edgeVisit.timezone;
        }
        const unlockRecord = recordUnlock(visitorMeta);
        lastUnlockRecord = unlockRecord;

        sendUnlockAnalytics(unlockRecord.activeEntry, visitorMeta);
        await renderMap(unlockRecord.entries, unlockRecord.activeEntry);
        window.setTimeout(() => {
          void autoSharpenLocation();
        }, 250);
      } catch (error) {
        console.warn("secret page visitor readout failed", error);
      }
    };

    mapStage?.addEventListener("click", (event) => {
      if (
        !event.target.closest(
          ".sirui-globe-marker, .sirui-map-marker-group, .sirui-celestial-marker, .sirui-street-map-panel, .sirui-marker-card",
        )
      ) {
        clearPinnedDetails();
      }
    });

    markerClose?.addEventListener("click", clearPinnedDetails);
    sharpenLocationButton?.addEventListener("click", sharpenLocation);
    viewModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setViewMode(button.dataset.siruiView);
      });
    });
    timeModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setCelestialMode(button.dataset.siruiTimeMode);
        updateSunSystemOnce();
      });
    });
    timeStepButtons.forEach((button) => {
      button.addEventListener("click", () => {
        stepCelestialHours(Number(button.dataset.siruiTimeStep) || 0);
      });
    });
    window.addEventListener("resize", fitConsoleToViewport, { passive: true });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !map?.hidden) {
        clearPinnedDetails();
      }
    });

    setCelestialMode(celestialMode);

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
