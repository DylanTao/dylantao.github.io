---
layout: page
title: "sirui's secrets"
description: A tiny locked corner.
permalink: /blog/2026/sirui-research-thoughts/
sitemap: false
search: false
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

  <div id="sirui-secret-copy" class="sirui-secret-copy" hidden></div>

  <section id="sirui-visitor-panel" class="sirui-visitor-panel" hidden>
    <h2>visitor readout</h2>
    <p class="sirui-map-note">
      Approximate location comes from browser timezone, not GPS. Unlocks also
      send a Google Analytics event named <code>secret_page_unlock</code>.
    </p>
    <dl id="sirui-visitor-facts" class="sirui-visitor-facts"></dl>
  </section>

  <section id="sirui-crack-map" class="sirui-crack-map" hidden>
    <h2>crack map</h2>
    <div class="sirui-world-map" aria-label="timezone-based visitor map">
      <svg viewBox="0 0 1000 520" role="img">
        <rect width="1000" height="520" rx="18"></rect>
        <path
          d="M142 130 211 98 284 116 304 170 252 210 208 186 166 228 111 202 92 158z"
        ></path>
        <path
          d="M258 246 316 280 344 358 304 444 254 416 235 344 203 306z"
        ></path>
        <path
          d="M455 118 552 91 632 118 704 105 809 151 890 178 856 236 752 220 694 250 615 222 542 239 477 205z"
        ></path>
        <path
          d="M511 247 590 236 642 283 627 370 572 436 528 385 493 315z"
        ></path>
        <path d="M778 337 842 328 887 374 860 425 790 407 756 365z"></path>
        <g id="sirui-map-markers"></g>
      </svg>
    </div>
    <div class="sirui-map-table-wrap">
      <table class="sirui-map-table">
        <thead>
          <tr>
            <th>visitor</th>
            <th>where-ish</th>
            <th>last local time</th>
            <th>times</th>
          </tr>
        </thead>
        <tbody id="sirui-crack-log"></tbody>
      </table>
    </div>
  </section>

  <script type="text/plain" id="sirui-private-payload">
    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
  </script>
</div>

<style>
  .sirui-private-note {
    max-width: 48rem;
  }

  .sirui-private-message {
    min-height: 1.5rem;
  }

  .sirui-private-message.is-unlocked {
    color: var(--global-text-color-light);
  }

  .sirui-secret-copy {
    margin-top: 1.5rem;
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

  .sirui-visitor-panel,
  .sirui-crack-map {
    margin-top: 1.75rem;
  }

  .sirui-map-note {
    color: var(--global-text-color-light);
    font-size: 0.9rem;
  }

  .sirui-visitor-facts {
    display: grid;
    gap: 0.65rem 1rem;
    grid-template-columns: minmax(8rem, max-content) 1fr;
    margin-top: 1rem;
  }

  .sirui-visitor-facts dt,
  .sirui-visitor-facts dd {
    border-bottom: 1px solid var(--global-divider-color);
    margin: 0;
    padding-bottom: 0.5rem;
  }

  .sirui-visitor-facts dt {
    color: var(--global-text-color-light);
    font-size: 0.9rem;
  }

  .sirui-world-map {
    margin-top: 1rem;
  }

  .sirui-world-map svg {
    display: block;
    height: auto;
    max-width: 100%;
  }

  .sirui-world-map rect {
    fill: color-mix(in srgb, var(--global-theme-color) 8%, transparent);
    stroke: var(--global-divider-color);
  }

  .sirui-world-map path {
    fill: color-mix(in srgb, var(--global-theme-color) 22%, var(--global-bg-color));
    opacity: 0.82;
    stroke: var(--global-divider-color);
    stroke-width: 2;
  }

  .sirui-map-marker {
    fill: var(--global-theme-color);
    stroke: var(--global-bg-color);
    stroke-width: 3;
  }

  .sirui-map-table-wrap {
    overflow-x: auto;
  }

  .sirui-map-table {
    margin-top: 1rem;
    width: 100%;
  }

  .sirui-map-table th,
  .sirui-map-table td {
    border-bottom: 1px solid var(--global-divider-color);
    padding: 0.45rem 0.35rem;
    text-align: left;
    white-space: nowrap;
  }

  @media (max-width: 576px) {
    .sirui-visitor-facts {
      grid-template-columns: 1fr;
    }

    .sirui-visitor-facts dt {
      border-bottom: 0;
      padding-bottom: 0;
    }
  }
</style>

<script>
  (() => {
    const container = document.getElementById("sirui-private-note");
    const message = document.getElementById("sirui-private-message");
    const payload = document.getElementById("sirui-private-payload");
    const secretCopy = document.getElementById("sirui-secret-copy");
    const visitorPanel = document.getElementById("sirui-visitor-panel");
    const visitorFacts = document.getElementById("sirui-visitor-facts");
    const map = document.getElementById("sirui-crack-map");
    const markerLayer = document.getElementById("sirui-map-markers");
    const logBody = document.getElementById("sirui-crack-log");

    const logKey = "siruiResearchThoughtsCrackLog";
    const browserIdKey = "siruiResearchThoughtsBrowserId";
    const passwordKey = "siruiResearchThoughtsPassword";

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

    const timezoneCoordinates = {
      "America/Los_Angeles": [-118.2437, 34.0522],
      "America/Denver": [-104.9903, 39.7392],
      "America/Chicago": [-87.6298, 41.8781],
      "America/New_York": [-74.006, 40.7128],
      "America/Toronto": [-79.3832, 43.6532],
      "America/Vancouver": [-123.1207, 49.2827],
      "Europe/London": [-0.1276, 51.5072],
      "Europe/Paris": [2.3522, 48.8566],
      "Europe/Berlin": [13.405, 52.52],
      "Asia/Shanghai": [121.4737, 31.2304],
      "Asia/Hong_Kong": [114.1694, 22.3193],
      "Asia/Tokyo": [139.6503, 35.6762],
      "Asia/Seoul": [126.978, 37.5665],
      "Asia/Singapore": [103.8198, 1.3521],
      "Australia/Sydney": [151.2093, -33.8688],
    };

    const fallbackCoordinates = () => {
      const offsetMinutes = new Date().getTimezoneOffset();
      const longitude = Math.max(-170, Math.min(170, -offsetMinutes / 4));
      return [longitude, 18];
    };

    const getCoordinates = (timezone) => {
      if (timezoneCoordinates[timezone]) {
        return {
          coordinates: timezoneCoordinates[timezone],
          source: "timezone match",
        };
      }

      return {
        coordinates: fallbackCoordinates(),
        source: "UTC offset estimate",
      };
    };

    const projectPoint = ([longitude, latitude]) => [
      ((longitude + 180) / 360) * 1000,
      ((90 - latitude) / 180) * 520,
    ];

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

    const getBrowserId = () => {
      const stored = safeLocalGet(browserIdKey);
      if (stored) return stored;

      const browserId =
        crypto.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      safeLocalSet(browserIdKey, browserId);
      return browserId;
    };

    const hashText = async (value) => {
      const buffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value),
      );
      return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 16);
    };

    const getBrowserSummary = () => {
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
      return "unknown browser";
    };

    const collectVisitorMeta = () => {
      const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
      const now = new Date();
      const localTime = now.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZoneName: "short",
      });

      return {
        browser: getBrowserSummary(),
        connection: connection
          ? [
              connection.effectiveType,
              connection.downlink ? `${connection.downlink} Mbps-ish` : "",
            ]
              .filter(Boolean)
              .join(", ") || "reported but hidden"
          : "not exposed",
        cookies: navigator.cookieEnabled ? "enabled" : "disabled",
        cores: navigator.hardwareConcurrency
          ? `${navigator.hardwareConcurrency}`
          : "not exposed",
        deviceMemory: navigator.deviceMemory
          ? `${navigator.deviceMemory} GB-ish`
          : "not exposed",
        doNotTrack: navigator.doNotTrack || window.doNotTrack || "not set",
        language:
          navigator.languages?.join(", ") || navigator.language || "unknown",
        localTime,
        platform:
          navigator.userAgentData?.platform || navigator.platform || "unknown",
        referrer: document.referrer || "direct",
        screen: `${screen.width} x ${screen.height} @ ${
          window.devicePixelRatio || 1
        }x`,
        timezone,
        touchPoints: `${navigator.maxTouchPoints || 0}`,
        viewport: `${window.innerWidth} x ${window.innerHeight}`,
      };
    };

    const renderVisitorPanel = (entry, meta, anonymousCrackerId) => {
      if (!visitorPanel || !visitorFacts) return;

      const facts = [
        ["anonymous id", anonymousCrackerId],
        ["mapped from", `${meta.timezone} (${entry.coordinateSource})`],
        ["local time", meta.localTime],
        ["browser", meta.browser],
        ["platform", meta.platform],
        ["screen", meta.screen],
        ["viewport", meta.viewport],
        ["language", meta.language],
        ["connection", meta.connection],
        ["CPU threads", meta.cores],
        ["memory hint", meta.deviceMemory],
        ["touch points", meta.touchPoints],
        ["cookies", meta.cookies],
        ["do not track", meta.doNotTrack],
        ["referrer", meta.referrer],
        ["this browser", `${entry.count} successful unlock(s)`],
      ];

      visitorFacts.replaceChildren(
        ...facts.flatMap(([label, value]) => {
          const term = document.createElement("dt");
          const detail = document.createElement("dd");
          term.textContent = label;
          detail.textContent = value;
          return [term, detail];
        }),
      );
      visitorPanel.hidden = false;
    };

    const sendUnlockAnalytics = (entry, meta, anonymousCrackerId) => {
      if (typeof gtag !== "function") return;

      gtag("event", "secret_page_unlock", {
        event_category: "secret_page",
        event_label: "sirui_research_thoughts",
        page_path: "/blog/2026/sirui-research-thoughts/",
        cracker_id: anonymousCrackerId,
        unlock_timezone: entry.timezone,
        unlock_local_time: entry.lastLocalTime,
        unlock_count_for_browser: entry.count,
        visitor_browser: meta.browser,
        visitor_platform: meta.platform,
        visitor_language: meta.language,
        visitor_screen: meta.screen,
        visitor_connection: meta.connection,
      });
    };

    const recordUnlock = (meta) => {
      const now = new Date();
      const browserId = getBrowserId();
      const { coordinates, source } = getCoordinates(meta.timezone);
      const entries = getLog();
      const id = `${browserId}|${meta.timezone}`;
      const existing = entries.find((entry) => entry.id === id);
      let activeEntry = existing;

      if (existing) {
        existing.browserId = existing.browserId || browserId;
        existing.label = "you";
        existing.coordinates = Array.isArray(existing.coordinates)
          ? existing.coordinates
          : coordinates;
        existing.coordinateSource = existing.coordinateSource || source;
        existing.count += 1;
        existing.lastLocalTime = meta.localTime;
        existing.lastIso = now.toISOString();
        existing.meta = meta;
      } else {
        activeEntry = {
          id,
          browserId,
          label: "you",
          timezone: meta.timezone,
          coordinateSource: source,
          count: 1,
          firstLocalTime: meta.localTime,
          lastLocalTime: meta.localTime,
          lastIso: now.toISOString(),
          coordinates,
          meta,
        };
        entries.push(activeEntry);
      }

      saveLog(entries);
      return { entries, activeEntry };
    };

    const renderMap = (entries) => {
      if (!map || !markerLayer || !logBody) return;

      markerLayer.replaceChildren();
      logBody.replaceChildren();

      entries
        .slice()
        .sort((a, b) => (b.lastIso || "").localeCompare(a.lastIso || ""))
        .forEach((entry) => {
          const visitorLabel = entry.label || entry.handle || "you";
          const coordinates = Array.isArray(entry.coordinates)
            ? entry.coordinates
            : fallbackCoordinates();
          const [x, y] = projectPoint(coordinates);
          const marker = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
          );
          marker.setAttribute("class", "sirui-map-marker");
          marker.setAttribute("cx", x.toFixed(1));
          marker.setAttribute("cy", y.toFixed(1));
          marker.setAttribute("r", String(8 + Math.min(entry.count, 6)));

          const title = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "title",
          );
          title.textContent = `${visitorLabel} - ${entry.lastLocalTime} - ${entry.count}x`;
          marker.appendChild(title);
          markerLayer.appendChild(marker);

          const row = document.createElement("tr");
          [
            visitorLabel,
            `${entry.timezone} (${entry.coordinateSource || "timezone"})`,
            entry.lastLocalTime,
            `${entry.count}`,
          ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
          });
          logBody.appendChild(row);
        });

      map.hidden = false;
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

      let decryptedHtml = "";
      try {
        decryptedHtml = await decryptSecret(password);
      } catch {
        sessionStorage.removeItem(passwordKey);
        message.innerHTML =
          'wrong password. go back to the <a href="{{ "/blog/" | relative_url }}">blog page</a> and try the dog again.';
        return;
      }

      sessionStorage.removeItem(passwordKey);
      secretCopy.innerHTML = decryptedHtml;
      secretCopy.hidden = false;
      message.textContent = "access granted.";
      message.classList.add("is-unlocked");

      try {
        const visitorMeta = collectVisitorMeta();
        const unlockRecord = recordUnlock(visitorMeta);
        const anonymousCrackerId = await hashText(
          unlockRecord.activeEntry.browserId,
        );

        renderVisitorPanel(
          unlockRecord.activeEntry,
          visitorMeta,
          anonymousCrackerId,
        );
        renderMap(unlockRecord.entries);
        sendUnlockAnalytics(
          unlockRecord.activeEntry,
          visitorMeta,
          anonymousCrackerId,
        );

        message.textContent = "access granted. browser crumbs collected.";
      } catch (error) {
        console.warn("secret page visitor readout failed", error);
        message.textContent = "access granted. visitor readout had a hiccup.";
      }
    };

    const storedPassword = sessionStorage.getItem(passwordKey);

    if (storedPassword) {
      unlock(storedPassword);
    } else {
      message.innerHTML =
        'locked. enter through the dog on the <a href="{{ "/blog/" | relative_url }}">blog page</a>.';
    }
  })();
</script>

<noscript>This page needs JavaScript to unlock.</noscript>
