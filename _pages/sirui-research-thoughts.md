---
layout: page
title: "sirui's secrets"
description: A tiny locked corner.
permalink: /blog/2026/sirui-research-thoughts/
sitemap: false
search: false
robots: noindex, nofollow
secret_globe: true
map: true
hide_title: true
---

<div
  id="sirui-private-note"
  class="sirui-private-note"
  data-visitor-endpoint="{{ site.sirui_visitor_endpoint | default: '' | escape }}"
  data-three-module-url="{{ '/assets/js/three.module.min.js' | relative_url | bust_file_cache | escape }}"
  data-globe-texture-url="{{ '/assets/img/sirui/earth-bmng-nov-5400.jpg' | relative_url | escape }}"
  data-globe-fallback-texture-url="{{ site.third_party_libraries.three-globe.url.earth_blue_marble | escape }}"
  data-globe-bump-url="{{ site.third_party_libraries.three-globe.url.earth_topology | escape }}"
  data-night-sky-url="{{ site.third_party_libraries.three-globe.url.night_sky | escape }}"
  data-blog-url="{{ '/blog/' | relative_url | escape }}"
  data-salt="iJoDMgLewA59OFlKJNkqyA=="
  data-iv="l6gF7cRta+KJfOKq"
>
  <div id="sirui-private-message" class="sirui-private-message" aria-live="polite">
    checking access...
  </div>

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

      <div class="sirui-map-toolbar">
        <div class="sirui-view-controls" role="toolbar" aria-label="visitor map view modes">
          <button type="button" data-sirui-view="visitor" class="is-active">visitor</button>
          <button type="button" data-sirui-view="sun">sun</button>
          <button type="button" data-sirui-view="moon">moon</button>
          <button type="button" data-sirui-view="orbit">orbit</button>
        </div>
        <div class="sirui-time-controls" role="toolbar" aria-label="sky time controls">
          <button type="button" data-sirui-time-step="-1">-1h</button>
          <button type="button" data-sirui-time-mode="pause">pause</button>
          <button type="button" data-sirui-time-mode="realtime" class="is-active">realtime</button>
          <button type="button" data-sirui-time-mode="fast">90x</button>
          <button type="button" data-sirui-time-step="1">+1h</button>
        </div>
      </div>

      <div class="sirui-map-stage">
        <div
          id="sirui-globe"
          class="sirui-globe-canvas"
          role="img"
          aria-describedby="sirui-globe-status"
          aria-label="3D where-ish visitor globe"
        ></div>
        <div class="sirui-globe-loading" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <p id="sirui-globe-status" class="sr-only" aria-live="polite">
          Waiting for the where-ish signal.
        </p>

        <div id="sirui-street-map-panel" class="sirui-street-map-panel" hidden aria-live="polite">
          <div class="sirui-street-map-header">
            <span>street view</span>
            <strong id="sirui-street-map-title">nearby map</strong>
          </div>
          <div
            id="sirui-street-map"
            class="sirui-street-map"
            role="img"
            aria-label="Fixed OpenStreetMap nearby street view"
          ></div>
          <p id="sirui-street-map-status" class="sirui-street-map-status" hidden>
            Map tiles did not load here. Zoom out slightly.
          </p>
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

        <div class="sirui-map-hud" aria-live="polite">
          <div class="sirui-map-readout sirui-info-panel">
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
              <button id="sirui-sharpen-location" class="sirui-sharpen-location" type="button" hidden>use precise location</button>
              <button
                id="sirui-street-details-toggle"
                class="sirui-street-details-toggle"
                type="button"
                aria-expanded="false"
                hidden
              >
                details
              </button>
              <button id="sirui-back-to-globe" class="sirui-back-to-globe" type="button" hidden>back to globe</button>
            </div>
          </div>

          <aside id="sirui-marker-card" class="sirui-marker-card sirui-info-panel" hidden>
            <button id="sirui-marker-close" class="sirui-marker-close" type="button" aria-label="Close marker details">x</button>
            <p class="sirui-marker-kicker">marker details</p>
            <h3 id="sirui-marker-title">visitor</h3>
            <dl id="sirui-marker-facts"></dl>
          </aside>

          <div class="sirui-sky-strip sirui-info-panel">
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
            <div class="sirui-sun-hud" aria-live="polite">
              <span>orbit sim</span>
              <span id="sirui-sun-utc">UTC --</span>
              <span id="sirui-orbit-clock">real time</span>
              <span id="sirui-sun-point">sun --</span>
              <span id="sirui-moon-point">moon --</span>
            </div>
            <p class="sirui-source-credit">Earth texture: NASA Earth Observatory.</p>
          </div>
        </div>
      </div>
    </div>

  </section>

  <section id="sirui-secret-note-wrap" class="sirui-secret-note" hidden aria-label="decrypted note">
    <div id="sirui-secret-copy" class="sirui-secret-copy"></div>
  </section>

  <script type="text/plain" id="sirui-private-payload">
    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
  </script>
</div>

{% if page.secret_globe %}

<link rel="stylesheet" href="{{ '/assets/css/secret-globe.css' | relative_url | bust_file_cache }}">
{% endif %}

{% if page.secret_globe %}

<script src="{{ '/assets/js/secret-globe.js' | relative_url | bust_file_cache }}"></script>

{% endif %}

<noscript>This page needs JavaScript to unlock.</noscript>
