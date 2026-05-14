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
  data-salt="LBxTYJSLodO2i8jIH9S+qQ=="
  data-iv="OVoAXmXeHZyZOyeh"
>
  <p id="sirui-private-message" class="sirui-private-message" aria-live="polite">
    checking access...
  </p>

  <div id="sirui-secret-copy" class="sirui-secret-copy" hidden></div>

  <section id="sirui-visitor-panel" class="sirui-visitor-panel" hidden>
    <h2>visitor readout</h2>
    <p class="sirui-map-note">
      Approx location comes from browser timezone, not GPS. The unlock event is
      also sent to Google Analytics as <code>secret_page_unlock</code>.
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
    GNlhOz6Slnz0OrNR3vE5JP2+oSzlDqSkeOK90vWKLGHWVhOnGg+riJaaaTo1UPIXXcYvhY1xUYFhHYmc+t1zYVZWvN+FJV+Us0LY+qHciXmMJeRd+KexrQ8fyLD8KJ3WBvUcDWYU3hZ0lQqDq+1tmPRcNXsct3KWldDExeZx3fLhExkqx+luUKfQLDVu/oSkeTndSJohCMv4qUbnA+HKAvMPt3pthPy3wF303bnTzE2e1otUtP4z05ceVr65qZrnWunqI1R8dbx6BaJ5+qPQK/GYkVC/TZ3HDsNhiXkRfBkBvq64/2QXwx8w+DYSLo2cEA39jg0eLWekYW/fz4rzNSTFBybpsAbXZmsOehBbqSwGXPVDqbBqBMjeOdblb0Z3ZVunxsHeEc05IVTLRdFLkIfsm1KGIBhdoAtWyxNdaiE+3ZcefHYga/7ggmALWDhC2zwLFacDxWlYMAaj7PL9lLuL8Fvm4oZfjcXKrvd5fwOMjkBZybI4SzRQEqs9gfQzrRLILxBoRYkIVHWyonfzWjYh1lCWPH2HOMvrW/66sumYMuh42uLTKQdB1e4aanmurRyJhEPcHgV6KxAXkj8v33MU545oTUY8+uuudoD8YZH1RmfB3qOCcngUWHP1YSkyKrAIFFGnnGED7ZVBPFAG+6JvawWYvft90M8g8SqBjmhy4zXf0zJN/bNMfYfutRTRpXdTQ6dfJkHDkSau4fkOhzyGSBd11/i4M6KRlGTuqyDCh5MXeiN6VTD6xGgSIElUGUt4M4yDqqB9voI2BeLEJ+7BuswCfusbIUxNpYnKehlg2Wv7l05l4YC7/OskeUKwvStNRFMq6awmEaMJhI96prKjJOXmJILIi0hqvQ1DhdYQrKDXib9AJkuqQ5rgJzDQ09ngO30+IuEmogHZ7W30AY9wOXW05boyazafLEYIWCwFaeW4pkC+K8VlTNsLSdFwbDhRHsRQv+ffzu6FHfjtq3WpiTYVbMs4wVxGwAGYoZHbPTpVBAJJ/6S13us1/BKrCvpY7mHZoTN4CfovuPKCidFetwXLiBrPkxWJ21tXAlqWBmjYbYJbbx8WQ2KzIhRuOW0L6TmMbBTtZljpHeVszaHbdgdolXw7xQzuNibohMUPtL1wE2eAXXxau+EMdiqEAh1Z+oHhfcwPLoxtTDE3mUp2xOGH8uRGFf6hNynhrtcnubPOA1ACv+VeWH+dv9tKvyXeLHkSJSFCIh6bXFq7IzIhM0NMrNlVWsPInPP6eZlCx7xRTx1RUuQA4ML4VEkEAQynpJd/TRqEK+vL4pA9KVAArxxrYIrVD47LAisHaPZe+BKcgeFtOO48rIwreIMu7P1JUw3o+wr38/s0CCH4A5fchxeSwkt1QNL/F87UAByqXrF0H8xyIFgcmKMHtbFpOIR8cweRAsSn1KXVYfAaa2b6SiGCZuhnC3SaUh8lsaSxUpPqd++3RJDZBacj+/vReALjGDuf+Hfw9qHHw3mqfoUJefap6TNvBFXE7E2wUzaDpESQfA7jEi+bega/yyfrGVdhGErS4SqpuVM=
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

  .sirui-secret-copy ol {
    padding-left: 1.35rem;
  }

  .sirui-secret-copy li {
    margin-bottom: 0.35rem;
  }

  .sirui-secret-copy blockquote {
    border-left: 0.25rem solid var(--global-theme-color);
    color: var(--global-text-color);
    margin: 1rem 0;
    padding: 0.25rem 0 0.25rem 1rem;
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

    const getLog = () => {
      try {
        return JSON.parse(localStorage.getItem(logKey)) || [];
      } catch {
        return [];
      }
    };

    const saveLog = (entries) => {
      localStorage.setItem(logKey, JSON.stringify(entries));
    };

    const getBrowserId = () => {
      const stored = localStorage.getItem(browserIdKey);
      if (stored) return stored;

      const browserId =
        crypto.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(browserIdKey, browserId);
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
        existing.coordinates = existing.coordinates || coordinates;
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
          const [x, y] = projectPoint(entry.coordinates);
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

    const unlock = async (password) => {
      message.textContent = "checking access...";

      try {
        const key = await deriveKey(
          password,
          b64ToBytes(container.dataset.salt),
        );
        const decrypted = await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: b64ToBytes(container.dataset.iv),
          },
          key,
          b64ToBytes(payload.textContent),
        );

        sessionStorage.removeItem(passwordKey);
        secretCopy.innerHTML = new TextDecoder().decode(decrypted);
        secretCopy.hidden = false;

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
        message.classList.add("is-unlocked");
      } catch {
        sessionStorage.removeItem(passwordKey);
        message.innerHTML =
          'wrong password. go back to the <a href="{{ "/blog/" | relative_url }}">blog page</a> and try the dog again.';
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
