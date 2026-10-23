(() => {
  const settings = document.getElementById("sirui-private-note")?.dataset;
  if (!settings) return;
  const message = document.getElementById("sirui-private-message");
  const map = document.getElementById("sirui-crack-map");
  const mapShell = map?.querySelector(".sirui-map-shell");
  const mapStage = map?.querySelector(".sirui-map-stage");
  mapShell?.style.setProperty("--sirui-night-sky", `url("${settings.nightSkyUrl}")`);
  const globeElement = document.getElementById("sirui-globe");
  const globeStatus = document.getElementById("sirui-globe-status");
  const streetMapPanel = document.getElementById("sirui-street-map-panel");
  const streetMapElement = document.getElementById("sirui-street-map");
  const streetMapStatus = document.getElementById("sirui-street-map-status");
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
  const mapCount = document.getElementById("sirui-map-count");
  const locationSource = document.getElementById("sirui-location-source");
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
  const backToGlobeButton = document.getElementById("sirui-back-to-globe");
  const streetDetailsToggle = document.getElementById("sirui-street-details-toggle");
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
  const fruitPassKey = "siruiSecretFruitPass";
  const oldPasswordKey = "siruiResearchThoughtsPassword";
  const readoutVersion = "globe_v1";
  const visitorEndpoint = settings.visitorEndpoint.trim();
  const svgNamespace = "http://www.w3.org/2000/svg";
  const threeModuleUrl = settings.threeModuleUrl;
  const globeTextureUrl = settings.globeTextureUrl;
  const globeFallbackTextureUrl = settings.globeFallbackTextureUrl;
  const globeBumpUrl = settings.globeBumpUrl;
  const streetErrorTileUrl = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#182019"/><path d="M0 128h256M128 0v256" stroke="#2f473a" stroke-width="1"/><path d="M0 0h256v256H0z" fill="none" stroke="#3b5748" stroke-width="2"/></svg>'
  )}`;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const streetMapMinZoom = 3;
  const streetMapMaxZoom = 17;
  const globeInspectMinAltitude = 1.12;
  const globeWheelZoomSensitivity = 0.00125;
  const streetMorphStartAltitude = 2.55;
  const streetMorphEndAltitude = 1.08;
  const streetMainEnterProgress = 0.74;
  const streetMainExitProgress = 0.56;
  const globeInsetStartProgress = 0.6;
  const streetTransitionMs = 560;
  const streetSyncThrottleMs = 120;
  const sunSystemIntervalMs = 4200;
  const celestialLayerIntervalMs = 18000;

  let globeInstance = null;
  let globeResizeObserver = null;
  let threeModulePromise = null;
  let streetMapInstance = null;
  let streetMarker = null;
  let streetAccuracyCircle = null;
  let sunTimer = null;
  let sunSystemStartToken = 0;
  let celestialBaseRealTime = Date.now();
  let celestialBaseSimTime = celestialBaseRealTime;
  let celestialSpeed = 1;
  let celestialMode = "realtime";
  let activeMarkerId = "";
  let lastUnlockRecord = null;
  let browserPrecisionRequestInFlight = false;
  let currentGlobeAltitude = 2.45;
  let currentGlobeEntries = [];
  let focusedGlobeEntry = null;
  let activeViewMode = "visitor";
  let streetSyncLocked = false;
  let globeSyncLocked = false;
  let syncSource = null;
  let syncUnlockTimer = null;
  let streetSyncFrame = 0;
  let streetSyncTimeout = 0;
  let streetInvalidateFrame = 0;
  let streetInvalidateSettleTimer = 0;
  let streetZoomGlideTimer = 0;
  let streetZoomGlideToken = 0;
  let streetZoomGlideTarget = null;
  let streetTileErrorCount = 0;
  let streetTileLoadCount = 0;
  let streetFocusAnimation = null;
  let streetFocusAnimationFrame = 0;
  let streetFocusTargetUntil = 0;
  let streetFocusTargetView = null;
  let pendingStreetSync = null;
  let streetMorphProgress = 0;
  let streetMainActive = false;
  let streetPresentationTarget = false;
  let streetPresentationToken = 0;
  let streetViewActive = false;
  let streetSheetExpanded = false;
  let streetRevealTimer = 0;
  let streetExitSuppressUntil = 0;
  let ignoreNextStageClickFromStreetMap = false;
  let ignoreStreetMapStageClickTimer = 0;
  let lastStreetSyncAt = 0;
  let lastStreetSyncView = null;
  let lastCelestialLayerUpdate = 0;
  let celestialLayerRefreshPending = false;
  let lastSkySnapshot = null;
  const initialBodyPaddingBottom = document.body.style.paddingBottom;

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

  const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

  const toFiniteNumber = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const formatPlaceParts = (place) =>
    [place?.neighborhood, place?.city, place?.regionCode || place?.region, place?.countryName || place?.country].filter(hasValue).join(", ");

  const formatCoordinatePair = (lat, lng) => {
    const latitude = toFiniteNumber(lat);
    const longitude = toFiniteNumber(lng);

    if (latitude === null || longitude === null) return "";

    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  };

  const formatMeters = (value) => {
    const meters = toFiniteNumber(value);
    if (meters === null) return "";

    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  };

  const formatKilometers = (value) => {
    const kilometers = toFiniteNumber(value);
    if (kilometers === null) return "";

    return kilometers >= 10 ? `${Math.round(kilometers)} km` : `${kilometers.toFixed(1)} km`;
  };

  const distanceBetweenCoordinates = (a, b) => {
    const earthRadiusKm = 6371;
    const latA = (a.lat * Math.PI) / 180;
    const latB = (b.lat * Math.PI) / 180;
    const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
    const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;
    const haversine =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
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
    placeFromBrowserLocation(meta.browserLocation, meta.timezone) || placeFromEdgeVisit(meta.edgeVisit) || getPlace(meta.timezone);

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

    const browserId = crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    safeLocalSet(browserIdKey, browserId);
    return browserId;
  };

  const getBrowserSummary = () => {
    try {
      if (navigator.userAgentData?.brands?.length) {
        return navigator.userAgentData.brands.map((brand) => `${brand.brand} ${brand.version}`).join(", ");
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
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const now = new Date();
    const timezone = readSafely(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    const localTime = readSafely(() =>
      new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        timeZoneName: "short",
        year: "numeric",
      }).format(now)
    );
    const connectionSummary = connection
      ? [connection.effectiveType, connection.downlink ? `${connection.downlink} Mbps-ish` : ""].filter(Boolean).join(", ")
      : "";

    return {
      browser: getBrowserSummary(),
      connection: connectionSummary,
      cookies: navigator.cookieEnabled ? "enabled" : "disabled",
      cores: readSafely(() => navigator.hardwareConcurrency),
      deviceMemory: readSafely(() => (navigator.deviceMemory ? `${navigator.deviceMemory} GB-ish` : "")),
      doNotTrack: readSafely(() => navigator.doNotTrack || window.doNotTrack),
      language: readSafely(() => navigator.languages?.join(", ") || navigator.language),
      localHour: now.getHours(),
      localTime,
      platform: readSafely(() => navigator.userAgentData?.platform || navigator.platform),
      referrer: document.referrer,
      screen: readSafely(() => `${screen.width} x ${screen.height} @ ${window.devicePixelRatio || 1}x`),
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
        unlock_method: "fruit_checkpoint",
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
    return safeCount === 1 ? "1 successful unlock" : `${safeCount} successful unlocks`;
  };

  const normalizeEntry = (entry) => {
    const legacyCoordinates = entry.place?.coordinates || entry.coordinates || null;
    const storedLat = toFiniteNumber(entry.place?.lat);
    const storedLng = toFiniteNumber(entry.place?.lng);
    const legacyLat = Array.isArray(legacyCoordinates) ? toFiniteNumber(legacyCoordinates[1]) : null;
    const legacyLng = Array.isArray(legacyCoordinates) ? toFiniteNumber(legacyCoordinates[0]) : null;
    const storedPlace =
      storedLat !== null && storedLng !== null
        ? {
            ...entry.place,
            lat: storedLat,
            lng: storedLng,
            source: entry.place.source || entry.coordinateSource || "stored coordinates",
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
        coordinateSource: place.source || entry.coordinateSource || "stored coordinates",
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
      return coordinates ? `${entry.timezone} timezone; ${coordinates}` : `${entry.timezone} timezone`;
    }

    return source ? `${entry.timezone} (${source})` : entry.timezone;
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
      ["edge coordinates", formatCoordinatePair(edgeVisit.lat ?? edgeVisit.latitude, edgeVisit.lng ?? edgeVisit.longitude)],
      ["edge observed", edgeVisit.requestTime],
      ["ASN", edgeVisit.asn],
      ["network", edgeVisit.asOrganization],
      ["browser coordinates", formatCoordinatePair(browserLocation.lat, browserLocation.lng)],
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
    setText(mapPlace, whereLabel(entry));
    setText(mapTimezone, timezoneLabel(entry));
    setText(mapTime, entry?.lastLocalTime);
    setText(mapCount, formatUnlockCount(entry?.browserUnlockCount || entry?.count));
    setText(locationSource, locationSourceLabel(entry));
    if (sharpenLocationButton) {
      const hasBrowserPrecision = entry?.coordinateSource === "browser geolocation";
      sharpenLocationButton.hidden = !navigator.geolocation || hasBrowserPrecision;
    }
    setText(statusPlace, whereLabel(entry));
    setText(statusTime, entry?.lastLocalTime);
    setText(statusCount, formatUnlockCount(entry?.browserUnlockCount || entry?.count));
  };

  const setActiveMarker = (id) => {
    activeMarkerId = id || "";
    document.querySelectorAll(".sirui-map-marker-group, .sirui-globe-marker, .sirui-celestial-marker").forEach((marker) => {
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

  let suppressMarkerFocusDetailsUntil = 0;

  const suppressNextMarkerFocusDetails = () => {
    suppressMarkerFocusDetailsUntil = performance.now() + 700;
  };

  const shouldSuppressMarkerFocusDetails = () => performance.now() < suppressMarkerFocusDetailsUntil;

  const suppressStageClickAfterStreetMapInteraction = () => {
    ignoreNextStageClickFromStreetMap = true;

    if (ignoreStreetMapStageClickTimer) {
      window.clearTimeout(ignoreStreetMapStageClickTimer);
    }

    ignoreStreetMapStageClickTimer = window.setTimeout(() => {
      ignoreNextStageClickFromStreetMap = false;
      ignoreStreetMapStageClickTimer = 0;
    }, 900);
  };

  const showMarkerDetails = (entry, { pinned = false } = {}) => {
    if (!markerCard || !markerTitle || !markerFacts) return;

    if (pinned) detailsPinned = true;
    setActiveMarker(entry.id);
    markerTitle.textContent = whereLabel(entry);
    markerFacts.replaceChildren(...detailsForEntry(entry).map(([label, value]) => createFactRow(label, value)));
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

  const showMarkerDetailsFromFocus = (entry) => {
    if ((streetViewActive || shouldSuppressMarkerFocusDetails()) && !detailsPinned) {
      setActiveMarker(entry.id);
      return;
    }

    showMarkerDetails(entry);
  };

  const streetViewZoomForEntry = (entry) => {
    if (entry?.coordinateSource === "browser geolocation") return clampStreetZoom(16.5);
    if (entry?.coordinateSource === "edge IP geo") return 11.5;
    return 5.5;
  };

  const setStreetSheetExpanded = (expanded) => {
    streetSheetExpanded = Boolean(expanded && streetViewActive);
    mapStage?.classList.toggle("is-street-sheet-expanded", streetSheetExpanded);
    if (streetDetailsToggle) {
      streetDetailsToggle.hidden = !streetViewActive;
      streetDetailsToggle.setAttribute("aria-expanded", String(streetSheetExpanded));
      streetDetailsToggle.textContent = streetSheetExpanded ? "less" : "details";
    }
  };

  const setStreetViewState = (active) => {
    streetViewActive = Boolean(active);
    mapStage?.classList.toggle("is-street-view-active", streetViewActive);
    if (backToGlobeButton) backToGlobeButton.hidden = !streetViewActive;
    setStreetSheetExpanded(false);
  };

  const revealStreetPanel = () => {
    if (streetRevealTimer) {
      window.clearTimeout(streetRevealTimer);
      streetRevealTimer = 0;
    }

    setStreetMapVisible(true, {
      full: false,
      progress: 0,
      settled: false,
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setStreetMapVisible(true, {
          full: true,
          progress: 1,
          settled: true,
        });
      });
    });
  };

  const enterStreetView = async (entry) => {
    const rawTarget = entry || activeVisitorEntry();
    if (!rawTarget) return;

    const target = normalizeEntry(rawTarget);
    if (!hasCoordinates(target) || target.kind) return;

    if (activeViewMode !== "visitor") {
      activeViewMode = "visitor";
      viewModeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.siruiView === "visitor");
      });
      mapStage?.classList.remove("is-sky-mode");
      if (skyPanel) skyPanel.hidden = true;
    }

    focusedGlobeEntry = target;
    clearPinnedDetails();
    setStreetViewState(true);
    setGlobeStatus(`Street view opening near ${whereLabel(target)}.`);

    const streetMap = await ensureStreetMap(target);
    if (!streetMap) {
      setStreetViewState(false);
      return;
    }

    const lat = Number(target.lat);
    const lng = Number(target.lng);
    const transitionMs = prefersReducedMotion.matches ? 0 : streetTransitionMs;
    const streetZoom = clampStreetZoom(streetViewZoomForEntry(target));

    streetMapTitle.textContent = whereLabel(target);
    setSyncSource("globe", transitionMs + 220);
    applyStreetMapView(streetMap, lat, lng, streetZoom, target);
    revealStreetPanel();

    globeInstance?.pointOfView(
      {
        altitude: 2.2,
        lat,
        lng,
      },
      transitionMs
    );

    updateStreetReadout(target);
  };

  const exitStreetView = ({ focusGlobe = true } = {}) => {
    if (!streetViewActive && !mapStage?.classList.contains("is-street-morphing")) return;

    if (streetRevealTimer) {
      window.clearTimeout(streetRevealTimer);
      streetRevealTimer = 0;
    }

    const transitionMs = prefersReducedMotion.matches ? 0 : streetTransitionMs;
    const entry = activeVisitorEntry();

    streetExitSuppressUntil = performance.now() + transitionMs + 900;
    streetMainActive = false;
    streetPresentationTarget = false;
    streetPresentationToken += 1;
    clearStreetFocusTarget();
    clearPendingStreetSync();
    setStreetViewState(false);
    clearPinnedDetails();
    setStreetMapVisible(true, {
      full: false,
      progress: 0,
      settled: true,
    });

    streetRevealTimer = window.setTimeout(() => {
      streetRevealTimer = 0;
      if (!streetViewActive) setStreetMapVisible(false);
    }, transitionMs);

    if (focusGlobe && globeInstance && hasCoordinates(entry)) {
      globeInstance.pointOfView(
        {
          altitude: 2.45,
          lat: entry.lat,
          lng: entry.lng,
        },
        transitionMs
      );
    }

    setGlobeStatus(hasCoordinates(entry) ? `Globe view centered near ${whereLabel(entry)}.` : "Globe view restored.");
    updateStreetReadout(entry);
  };

  const activateVisitorMarker = (entry) => {
    if (!hasCoordinates(entry) || entry?.kind) return;

    focusedGlobeEntry = entry;
    if (streetViewActive) {
      clearPinnedDetails();
      setActiveMarker(entry.id);
      setStreetSheetExpanded(false);
      setGlobeStatus(`Already in street view near ${whereLabel(entry)}.`);
      return;
    }

    void enterStreetView(entry);
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
      "aria-label": `open street view near ${whereLabel(entry)}`,
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
    group.addEventListener("pointerdown", suppressNextMarkerFocusDetails);
    group.addEventListener("focus", () => showMarkerDetailsFromFocus(entry));
    group.addEventListener("blur", hideMarkerDetails);
    group.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activateVisitorMarker(entry);
    });
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        activateVisitorMarker(entry);
      }
    });

    return group;
  };

  const hasCoordinates = (entry) => Number.isFinite(Number(entry?.lat)) && Number.isFinite(Number(entry?.lng));

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

  const clampStreetZoom = (zoom) => clamp(zoom, streetMapMinZoom, streetMapMaxZoom);

  const lerp = (start, end, progress) => start + (end - start) * clamp(progress, 0, 1);

  const smoothStep = (progress) => {
    const value = clamp(progress, 0, 1);
    return value * value * (3 - 2 * value);
  };

  const inverseSmoothStep = (progress) => {
    const target = clamp(progress, 0, 1);
    let value = target;

    for (let index = 0; index < 5; index += 1) {
      const current = smoothStep(value);
      const derivative = Math.max(6 * value * (1 - value), 0.001);
      value = clamp(value - (current - target) / derivative, 0, 1);
    }

    return value;
  };

  const isStreetSyncedMode = () => activeViewMode === "visitor";

  const clearStreetFocusTarget = () => {
    streetFocusAnimation = null;
    streetFocusTargetView = null;
    streetFocusTargetUntil = 0;
    if (streetFocusAnimationFrame) {
      window.cancelAnimationFrame(streetFocusAnimationFrame);
      streetFocusAnimationFrame = 0;
    }
  };

  const clearPendingStreetSync = () => {
    pendingStreetSync = null;
    if (streetSyncFrame) {
      window.cancelAnimationFrame(streetSyncFrame);
      streetSyncFrame = 0;
    }
    if (streetSyncTimeout) {
      window.clearTimeout(streetSyncTimeout);
      streetSyncTimeout = 0;
    }
  };

  const activeStreetFocusTarget = () => {
    const now = performance.now();

    if (streetFocusAnimation) {
      const { duration, fromPov, start, toPov } = streetFocusAnimation;
      const progress = duration ? smoothStep((now - start) / duration) : 1;

      if (progress < 1) {
        return {
          altitude: lerp(fromPov.altitude, toPov.altitude, progress),
          lat: lerp(fromPov.lat, toPov.lat, progress),
          lng: lerp(fromPov.lng, toPov.lng, progress),
        };
      }

      streetFocusAnimation = null;
      streetFocusTargetView = toPov;
      streetFocusTargetUntil = Math.max(streetFocusTargetUntil, now + 1400);
    }

    if (!streetFocusTargetView || now > streetFocusTargetUntil) {
      streetFocusTargetView = null;
      streetFocusTargetUntil = 0;
      return null;
    }

    return streetFocusTargetView;
  };

  const startStreetFocusMorph = (entry, targetPov, duration) => {
    if (!entry || !targetPov) return;

    clearStreetFocusTarget();

    const currentPov = globeInstance?.pointOfView?.() || {};
    const fromPov = {
      altitude: toFiniteNumber(currentPov.altitude) ?? currentGlobeAltitude,
      lat: toFiniteNumber(currentPov.lat) ?? Number(entry.lat),
      lng: toFiniteNumber(currentPov.lng) ?? Number(entry.lng),
    };
    const transitionMs = prefersReducedMotion.matches ? 0 : Math.max(duration || 0, 0);
    const startedAt = performance.now();

    streetFocusTargetView = targetPov;
    streetFocusTargetUntil = startedAt + transitionMs + 1600;

    if (transitionMs > 0) {
      streetFocusAnimation = {
        duration: transitionMs,
        fromPov,
        start: startedAt,
        toPov: targetPov,
      };
    }

    const step = () => {
      streetFocusAnimationFrame = 0;
      if (!isStreetSyncedMode() || activeVisitorEntry()?.id !== entry.id) {
        clearStreetFocusTarget();
        return;
      }

      const pov = activeStreetFocusTarget() || targetPov;
      setStreetPresentation(shouldUseStreetMainForAltitude(pov.altitude), {
        pov,
        sync: false,
      });
      scheduleStreetMapSync(entry, pov);

      if (streetFocusAnimation) {
        streetFocusAnimationFrame = window.requestAnimationFrame(step);
        return;
      }

      setStreetPresentation(shouldUseStreetMainForAltitude(targetPov.altitude), {
        pov: targetPov,
        sync: false,
      });
      scheduleStreetMapSync(entry, targetPov);
    };

    step();
  };

  const streetMorphProgressForAltitude = (altitude) =>
    smoothStep((streetMorphStartAltitude - (Number(altitude) || streetMorphStartAltitude)) / (streetMorphStartAltitude - streetMorphEndAltitude));

  const altitudeForStreetMorphProgress = (progress) =>
    streetMorphStartAltitude - inverseSmoothStep(progress) * (streetMorphStartAltitude - streetMorphEndAltitude);

  const shouldUseStreetMainForAltitude = (altitude) => {
    const progress = streetMorphProgressForAltitude(altitude);
    return streetMainActive ? progress >= streetMainExitProgress : progress >= streetMainEnterProgress;
  };

  const globeMarkerScale = () => clamp(0.68 + ((currentGlobeAltitude - globeInspectMinAltitude) / 2.6) * 0.24, 0.68, 0.96);

  const pointRadiusForEntry = (entry) => {
    const countBoost = Math.max(0, Math.min(Number(entry?.count) || 1, 8) - 1) * 0.0008;
    const baseRadius = entry?.isCurrent ? 0.024 : 0.018;

    return (baseRadius + countBoost) * globeMarkerScale();
  };

  const refreshGlobeMarkerScale = () => {
    if (!globeInstance) return;

    const scale = globeMarkerScale();
    globeInstance.pointRadius?.(pointRadiusForEntry);
    globeInstance.ringMaxRadius?.(streetMainActive ? 0.48 : 0.28 + scale * 0.5);
    globeInstance.ringPropagationSpeed?.(prefersReducedMotion.matches ? 0 : 0.18 + scale * 0.14);
  };

  const setGlobeStatus = (value) => {
    if (globeStatus) globeStatus.textContent = value;
  };

  const hasWebGl = () => {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  };

  const waitForThree = async () => {
    if (!threeModulePromise) {
      threeModulePromise = import(threeModuleUrl).catch((error) => {
        console.warn("secret page Three.js module failed", error);
        return null;
      });
    }

    return threeModulePromise;
  };

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

  const clearSyncSource = (source = null) => {
    if (source && syncSource !== source) return;

    if (syncUnlockTimer) {
      window.clearTimeout(syncUnlockTimer);
      syncUnlockTimer = null;
    }
    syncSource = null;
    streetSyncLocked = false;
    globeSyncLocked = false;
  };

  const setSyncSource = (source, maxMs = 240) => {
    clearSyncSource();
    syncSource = source;
    streetSyncLocked = source === "globe";
    globeSyncLocked = source === "street";

    if (maxMs > 0) {
      syncUnlockTimer = window.setTimeout(() => clearSyncSource(source), maxMs);
    }
  };

  const scheduleDeferredWork = (callback, timeout = 1200) => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(callback, { timeout });
      return;
    }

    window.setTimeout(callback, Math.min(timeout, 420));
  };

  const fitConsoleToViewport = () => {
    if (!map || map.hidden || !mapShell) return;

    const parsePixels = (value) => {
      const number = parseFloat(value);
      return Number.isFinite(number) ? number : 0;
    };
    const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 720;
    const shellStyle = getComputedStyle(mapShell);
    const shellRect = mapShell.getBoundingClientRect();
    const topRect = mapShell.querySelector(".sirui-map-topline")?.getBoundingClientRect();
    const toolbarRect = mapShell.querySelector(".sirui-map-toolbar")?.getBoundingClientRect();
    const rootFont = parsePixels(getComputedStyle(document.documentElement).fontSize) || 16;
    const fixedFooter = document.querySelector("footer.fixed-bottom");
    const footerHeight = fixedFooter ? Math.ceil(fixedFooter.getBoundingClientRect().height) : 0;
    const rowGap = parsePixels(shellStyle.rowGap || shellStyle.gap);
    const paddingY = parsePixels(shellStyle.paddingTop) + parsePixels(shellStyle.paddingBottom);
    const mobileHudReserve = window.innerWidth < 820 ? 150 : 0;
    const reserved =
      (topRect?.height || 0) +
      (toolbarRect?.height || 0) +
      paddingY +
      rowGap * 2 +
      footerHeight +
      mobileHudReserve +
      (window.innerWidth < 820 ? 12 : 16);
    const available = viewportHeight - shellRect.top - reserved;
    const minHeight = window.innerWidth < 480 ? 210 : window.innerWidth < 820 ? 235 : 250;
    const maxHeight = window.innerWidth < 820 ? 440 : 760;
    const height = clamp(available, minHeight, maxHeight);
    const roundedHeight = Math.round(height);
    const stageOffsetHeight = Math.round(height + rootFont * 0.65);
    const skyMaxHeight = Math.max(160, Math.round(height - rootFont * 1.5));
    const skyMobileMaxHeight = Math.max(130, Math.round(height - rootFont * 4.4));

    mapShell.classList.toggle("is-height-tight", height < 410 || viewportHeight < 780);
    map.style.setProperty("--sirui-map-bottom-gap", `${Math.round(footerHeight + rootFont * 0.85)}px`);
    map.style.setProperty("--sirui-stage-height", `${roundedHeight}px`);
    map.style.setProperty("--sirui-stage-offset-height", `${stageOffsetHeight}px`);
    map.style.setProperty("--sirui-sky-cockpit-max-height", `${skyMaxHeight}px`);
    map.style.setProperty("--sirui-sky-cockpit-mobile-max-height", `${skyMobileMaxHeight}px`);
    mapShell.style.setProperty("--sirui-stage-height", `${roundedHeight}px`);
    mapShell.style.setProperty("--sirui-stage-offset-height", `${stageOffsetHeight}px`);
    mapShell.style.setProperty("--sirui-sky-cockpit-max-height", `${skyMaxHeight}px`);
    mapShell.style.setProperty("--sirui-sky-cockpit-mobile-max-height", `${skyMobileMaxHeight}px`);
    document.body.style.paddingBottom = footerHeight ? `${footerHeight}px` : initialBodyPaddingBottom;
    if (mapStage?.classList.contains("is-street-morphing")) {
      updateStreetMorphLayout(streetMorphProgress, { visible: true });
    } else {
      invalidateStreetMapSettled();
    }
  };

  const normalizeLongitude = (longitude) => (((((Number(longitude) || 0) + 540) % 360) + 360) % 360) - 180;

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const toDegrees = (radians) => (radians * 180) / Math.PI;

  const getJulianDate = (date) => date.getTime() / 86400000 + 2440587.5;

  const getGreenwichSiderealTime = (date) => {
    const jd = getJulianDate(date);
    const centuries = (jd - 2451545) / 36525;

    return normalizeLongitude(
      280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * centuries * centuries - (centuries * centuries * centuries) / 38710000
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
    const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (minutes / 60 - 12) / 24);
    const declination =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma);
    const equationOfTime =
      229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

    return {
      lat: (declination * 180) / Math.PI,
      lng: normalizeLongitude(180 - (minutes + equationOfTime) / 4),
    };
  };

  const getSubsolarPointPrecise = (date = new Date()) => {
    const jd = getJulianDate(date);
    const days = jd - 2451545;
    const meanLongitude = normalizeLongitude(280.46 + 0.9856474 * days);
    const meanAnomaly = normalizeLongitude(357.528 + 0.9856003 * days);
    const eclipticLongitude = meanLongitude + 1.915 * Math.sin(toRadians(meanAnomaly)) + 0.02 * Math.sin(toRadians(2 * meanAnomaly));
    const obliquity = 23.439 - 0.0000004 * days;
    const rightAscension = normalizeLongitude(
      toDegrees(Math.atan2(Math.cos(toRadians(obliquity)) * Math.sin(toRadians(eclipticLongitude)), Math.cos(toRadians(eclipticLongitude))))
    );
    const declination = toDegrees(Math.asin(Math.sin(toRadians(obliquity)) * Math.sin(toRadians(eclipticLongitude))));

    return getSubpointFromRightAscension(date, rightAscension, declination);
  };

  const getSublunarPoint = (date = new Date()) => {
    const jd = getJulianDate(date);
    const days = jd - 2451543.5;
    const ascendingNode = normalizeLongitude(125.1228 - 0.0529538083 * days);
    const inclination = 5.1454;
    const argumentOfPerigee = normalizeLongitude(318.0634 + 0.1643573223 * days);
    const eccentricity = 0.0549;
    const meanAnomaly = normalizeLongitude(115.3654 + 13.0649929509 * days);
    const eccentricAnomaly =
      meanAnomaly + toDegrees(eccentricity * Math.sin(toRadians(meanAnomaly))) * (1 + eccentricity * Math.cos(toRadians(meanAnomaly)));
    const xv = Math.cos(toRadians(eccentricAnomaly)) - eccentricity;
    const yv = Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(toRadians(eccentricAnomaly));
    const trueAnomaly = toDegrees(Math.atan2(yv, xv));
    const radius = Math.sqrt(xv * xv + yv * yv);
    const nodeRadians = toRadians(ascendingNode);
    const orbitalAngle = toRadians(trueAnomaly + argumentOfPerigee);
    const inclinationRadians = toRadians(inclination);
    const xEcliptic =
      radius * (Math.cos(nodeRadians) * Math.cos(orbitalAngle) - Math.sin(nodeRadians) * Math.sin(orbitalAngle) * Math.cos(inclinationRadians));
    const yEcliptic =
      radius * (Math.sin(nodeRadians) * Math.cos(orbitalAngle) + Math.cos(nodeRadians) * Math.sin(orbitalAngle) * Math.cos(inclinationRadians));
    const zEcliptic = radius * Math.sin(orbitalAngle) * Math.sin(inclinationRadians);
    const obliquity = toRadians(23.4393 - 0.0000004 * (jd - 2451545));
    const xEquatorial = xEcliptic;
    const yEquatorial = yEcliptic * Math.cos(obliquity) - zEcliptic * Math.sin(obliquity);
    const zEquatorial = yEcliptic * Math.sin(obliquity) + zEcliptic * Math.cos(obliquity);
    const rightAscension = normalizeLongitude(toDegrees(Math.atan2(yEquatorial, xEquatorial)));
    const declination = toDegrees(Math.atan2(zEquatorial, Math.sqrt(xEquatorial * xEquatorial + yEquatorial * yEquatorial)));

    return getSubpointFromRightAscension(date, rightAscension, declination);
  };

  const formatCoordinate = (value, positive, negative) => {
    const number = Number(value) || 0;
    return `${Math.abs(number).toFixed(1)}\u00b0${number >= 0 ? positive : negative}`;
  };

  const sunVector = ({ lat, lng }, radius = 420) => {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((90 - lng) * Math.PI) / 180;

    return {
      x: radius * Math.sin(phi) * Math.cos(theta),
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
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z) || 1;

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
    const segments = 120;

    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const point = unitToLatLng({
        x: Math.cos(angle) * axisA.x + Math.sin(angle) * axisB.x,
        y: Math.cos(angle) * axisA.y + Math.sin(angle) * axisB.y,
        z: Math.cos(angle) * axisA.z + Math.sin(angle) * axisB.z,
      });

      points.push({ ...point, alt: 0.018 });
    }

    return points;
  };

  const buildNightHemisphere = (sunPosition) => {
    const nightCenter = {
      lat: -sunPosition.lat,
      lng: normalizeLongitude(sunPosition.lng + 180),
    };
    const center = latLngToUnit(nightCenter);
    const reference = Math.abs(center.z) > 0.92 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
    const axisA = normalizeVector(cross(center, reference));
    const axisB = normalizeVector(cross(center, axisA));
    const radius = toRadians(88.8);
    const coordinates = [];
    const segments = 120;

    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const point = unitToLatLng({
        x: Math.cos(radius) * center.x + Math.sin(radius) * (Math.cos(angle) * axisA.x + Math.sin(angle) * axisB.x),
        y: Math.cos(radius) * center.y + Math.sin(radius) * (Math.cos(angle) * axisA.y + Math.sin(angle) * axisB.y),
        z: Math.cos(radius) * center.z + Math.sin(radius) * (Math.cos(angle) * axisA.z + Math.sin(angle) * axisB.z),
      });

      coordinates.push([point.lng, point.lat]);
    }

    // Globe.GL uses spherical ring winding to choose the filled cap.
    // This order keeps the translucent cap on the antisolar hemisphere.
    coordinates.reverse();

    return [
      {
        geometry: {
          coordinates: [coordinates],
          type: "Polygon",
        },
        id: "night-side-shade",
      },
    ];
  };

  const buildMoonGroundTrack = (date) => {
    const points = [];

    for (let index = -24; index <= 24; index += 1) {
      const point = getSublunarPoint(new Date(date.getTime() + index * 60 * 60 * 1000));

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

  const buildCelestialPaths = (date, sunPosition) => {
    const terminator = buildTerminatorPath(sunPosition);

    return [
      ...geometricGridPaths,
      {
        color: "rgba(112, 216, 255, 0.2)",
        dashGap: 0,
        dashLength: 0,
        name: "soft terminator glow",
        points: terminator,
        stroke: 0.72,
      },
      {
        color: "rgba(255, 184, 86, 0.3)",
        dashGap: 0,
        dashLength: 0,
        name: "sunrise sunset edge",
        points: terminator,
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
  };

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
    updateSunSystemOnce({ forceLayers: true });
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
      waxing: age < cycle / 2,
    };
  };

  const updateSunHud = (date, sunPosition, moonPosition) => {
    if (sunUtc) {
      sunUtc.textContent = `UTC ${date.toISOString().slice(11, 16)}`;
    }

    if (orbitClock) {
      orbitClock.textContent = celestialSpeed === 0 ? "paused" : celestialSpeed === 1 ? "real time" : `${celestialSpeed}x sky`;
    }

    if (sunPoint) {
      sunPoint.textContent = `sun ${formatCoordinate(sunPosition.lat, "N", "S")}, ${formatCoordinate(sunPosition.lng, "E", "W")}`;
    }

    if (moonPoint) {
      moonPoint.textContent = `moon ${formatCoordinate(moonPosition.lat, "N", "S")}, ${formatCoordinate(moonPosition.lng, "E", "W")}`;
    }
  };

  const isSkyViewMode = (mode = activeViewMode) => ["sun", "moon", "orbit"].includes(mode);

  const updateSkyInfoReadout = ({ date, sunEntry, moonEntry }) => {
    const summary = `Sun ${formatCoordinate(sunEntry.lat, "N", "S")}, ${formatCoordinate(sunEntry.lng, "E", "W")} / Moon ${formatCoordinate(moonEntry.lat, "N", "S")}, ${formatCoordinate(moonEntry.lng, "E", "W")}`;
    const clockLabel = celestialSpeed === 0 ? "paused" : celestialSpeed === 1 ? "realtime" : `${celestialSpeed}x`;

    setText(skyInfoUtc, date.toISOString().slice(11, 19));
    setText(skyInfoClock, clockLabel);
    setText(skyInfoSummary, summary);
    if (!isSkyViewMode()) setText(skyInfoTitle, "live sky");

    return { clockLabel, summary };
  };

  const updateSkyCockpit = ({ date, sunEntry, moonEntry, moonPhase }) => {
    const activeCelestial = activeViewMode === "moon" ? moonEntry : activeViewMode === "sun" ? sunEntry : null;
    const { summary } = updateSkyInfoReadout({ date, moonEntry, sunEntry });

    if (!skyPanel) return;

    const showSky = isSkyViewMode();
    const moonShadowOpacity = clamp(1 - (moonPhase.illumination || 0), 0, 0.96);
    skyPanel.dataset.view = activeViewMode;
    skyPanel.style.setProperty("--sirui-moon-shadow-opacity", moonShadowOpacity.toFixed(3));
    skyPanel.style.setProperty("--sirui-moon-shadow-x", moonPhase.waxing ? "-26%" : "126%");
    skyPanel.hidden = !showSky;
    if (!showSky) return;

    const modeLabel = activeViewMode === "sun" ? "sun view" : activeViewMode === "moon" ? "moon view" : "orbit view";
    setText(skyMode, modeLabel);
    setText(skyTitle, activeViewMode === "sun" ? "Subsolar cockpit" : activeViewMode === "moon" ? "Sublunar cockpit" : "Stylized Earth-Moon scale");
    setText(skySubpoint, activeCelestial ? formatCoordinatePair(activeCelestial.lat, activeCelestial.lng) : summary);
    setText(skyPhase, moonPhase.label);
    setText(
      skyScale,
      activeViewMode === "orbit"
        ? "Moon drawn at 0.273x Earth radius; distance cinematic."
        : activeViewMode === "sun"
          ? "Sun disk is cinematic; subsolar point is the overhead location."
          : "Moon disk is cinematic; phase and sublunar point are simulated."
    );
    setText(skyInfoTitle, modeLabel);
  };

  const tuneGlobeRender = (globe) => {
    const renderer = globe.renderer?.();
    if (renderer?.setPixelRatio) {
      const pixelRatioCap = window.matchMedia("(max-width: 700px)").matches ? 1.55 : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
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
      material.bumpScale = 1.7;
      material.shininess = 10;
      material.color?.set?.("#ffffff");
      material.emissive?.set?.("#0a1815");
      material.emissiveIntensity = 0.075;
      material.needsUpdate = true;
    }

    const lights = globe.lights?.();
    if (Array.isArray(lights)) {
      lights.forEach((light) => {
        if (light.type === "AmbientLight") light.intensity = 0.58;
        if (light.type === "DirectionalLight") light.intensity = 1.62;
      });
    }
  };

  const updateSunlight = (globe, date = new Date()) => {
    const point = getSubsolarPointPrecise(date);
    const vector = sunVector(point);
    const lights = globe.lights?.();
    const directional = Array.isArray(lights) ? lights.find((light) => light.type === "DirectionalLight") : null;

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
    globe.pathDashAnimateTime?.((path) => (reducedMotion ? 0 : path.animateTime || 0));
    globe.pathTransitionDuration?.(reducedMotion ? 0 : 700);
  };

  const configureNightShade = (globe, reducedMotion) => {
    if (typeof globe.polygonsData !== "function") return;

    globe.polygonsData([]);
    globe.polygonGeoJsonGeometry?.("geometry");
    globe.polygonCapColor?.(() => "rgba(2, 5, 10, 0.26)");
    globe.polygonSideColor?.(() => "rgba(2, 5, 10, 0)");
    globe.polygonStrokeColor?.(() => "rgba(112, 216, 255, 0.08)");
    globe.polygonAltitude?.(0.009);
    globe.polygonCapCurvatureResolution?.(3.6);
    globe.polygonsTransitionDuration?.(reducedMotion ? 0 : 450);
  };

  const setGlobeVisualMotion = (globe, reducedMotion, enabled) => {
    const shouldAnimate = enabled && !reducedMotion;

    globe.pointsTransitionDuration?.(shouldAnimate ? 700 : 0);
    globe.htmlTransitionDuration?.(shouldAnimate ? 700 : 0);
    globe.pathTransitionDuration?.(shouldAnimate ? 700 : 0);
    globe.polygonsTransitionDuration?.(shouldAnimate ? 450 : 0);
    globe.ringPropagationSpeed?.(shouldAnimate ? 0.48 : 0);
    globe.ringRepeatPeriod?.(shouldAnimate ? 3200 : 0);
  };

  const stopSunTimer = () => {
    sunSystemStartToken += 1;
    celestialLayerRefreshPending = false;
    if (sunTimer) {
      window.clearInterval(sunTimer);
      sunTimer = null;
    }
  };

  const scheduleCelestialLayerRefresh = (timeout = 1400, token = sunSystemStartToken) => {
    if (celestialLayerRefreshPending) return;

    celestialLayerRefreshPending = true;
    scheduleDeferredWork(() => {
      if (token !== sunSystemStartToken) {
        celestialLayerRefreshPending = false;
        return;
      }

      celestialLayerRefreshPending = false;
      updateSunSystemOnce({ forceLayers: true });
    }, timeout);
  };

  const updateSunSystemOnce = ({ forceLayers = false } = {}) => {
    if (!globeInstance) return;

    const realNow = Date.now();
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
    const skySnapshot = { date, moonEntry, moonPhase, sunEntry };

    lastSkySnapshot = skySnapshot;
    updateSunHud(date, sunPosition, moonPosition);
    if (isSkyViewMode()) {
      updateSkyCockpit(skySnapshot);
    } else {
      updateSkyInfoReadout(skySnapshot);
      if (skyPanel) skyPanel.hidden = true;
    }
    globeInstance.htmlElementsData([...baseEntries, sunEntry, moonEntry]);

    const layersAreStale = lastCelestialLayerUpdate > 0 && realNow - lastCelestialLayerUpdate >= celestialLayerIntervalMs;
    const skyNeedsFirstLayers = isSkyViewMode() && lastCelestialLayerUpdate === 0;

    if (forceLayers || layersAreStale || skyNeedsFirstLayers) {
      globeInstance.pathsData?.(buildCelestialPaths(date, sunPosition));
      globeInstance.polygonsData?.(buildNightHemisphere(sunPosition));
      lastCelestialLayerUpdate = realNow;
    }

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

  const startSunSystem = ({ deferFirstUpdate = false } = {}) => {
    stopSunTimer();
    celestialBaseRealTime = Date.now();
    lastCelestialLayerUpdate = 0;
    const token = ++sunSystemStartToken;

    const beginSunSystem = () => {
      if (token !== sunSystemStartToken || !globeInstance) return;

      updateSunSystemOnce();
      scheduleCelestialLayerRefresh(1800, token);

      if (!prefersReducedMotion.matches && token === sunSystemStartToken) {
        sunTimer = window.setInterval(() => {
          if (token === sunSystemStartToken) updateSunSystemOnce();
        }, sunSystemIntervalMs);
      }
    };

    if (deferFirstUpdate) {
      scheduleDeferredWork(beginSunSystem, prefersReducedMotion.matches ? 420 : 1100);
      return;
    }

    beginSunSystem();
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
    const cue = document.createElement("span");

    button.type = "button";
    button.className = "sirui-globe-marker";
    button.dataset.entryId = entry.id;
    button.setAttribute("aria-label", `open street view near ${whereLabel(entry)}`);
    if (entry.isCurrent) button.classList.add("is-current", "is-active");

    dot.className = "sirui-globe-marker-dot";
    label.className = "sirui-globe-marker-label";
    count.className = "sirui-globe-marker-count";
    tooltip.className = "sirui-globe-marker-tooltip";
    cue.className = "sirui-globe-marker-cue";
    label.textContent = shortPlaceLabel(entry);
    count.textContent = Number(entry.count) > 1 ? ` x${entry.count}` : "";
    tooltip.textContent = `${timezoneLabel(entry)} - ${entry.lastLocalTime || "visit time pending"} - click for street view`;
    cue.textContent = "tap dot for street view";
    label.append(count);
    button.append(dot, label, cue, tooltip);

    button.addEventListener("mouseenter", () => previewMarker(entry));
    button.addEventListener("mouseleave", clearMarkerPreview);
    button.addEventListener("pointerdown", suppressNextMarkerFocusDetails);
    button.addEventListener("focus", () => showMarkerDetailsFromFocus(entry));
    button.addEventListener("blur", hideMarkerDetails);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activateVisitorMarker(entry);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        activateVisitorMarker(entry);
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

  const cssColor = (THREE, value, fallback = "#70d8ff") => {
    const colorValue = typeof value === "string" ? value : fallback;
    const rgba = colorValue.match(/rgba?\(([^)]+)\)/i);

    if (rgba) {
      const parts = rgba[1].split(",").map((part) => part.trim());
      const [red, green, blue] = parts;
      const alpha = parts[3] !== undefined ? Number(parts[3]) : 1;
      return {
        color: new THREE.Color(`rgb(${red}, ${green}, ${blue})`),
        opacity: Number.isFinite(alpha) ? alpha : 1,
      };
    }

    return {
      color: new THREE.Color(colorValue || fallback),
      opacity: 1,
    };
  };

  const latLngToThreeVector = (THREE, lat, lng, radius = 1) => {
    const latRadians = toRadians(Number(lat) || 0);
    const lngRadians = toRadians((Number(lng) || 0) + 180);
    const cosLat = Math.cos(latRadians);

    return new THREE.Vector3(-radius * cosLat * Math.cos(lngRadians), radius * Math.sin(latRadians), radius * cosLat * Math.sin(lngRadians));
  };

  const createSiruiThreeGlobe = (THREE, element) => {
    const state = {
      activeAnimation: 0,
      arcColor: () => "rgba(112, 216, 255, 0.26)",
      arcStroke: () => 0.16,
      disposed: false,
      height: Math.max(320, Math.floor(element.getBoundingClientRect().height || 420)),
      htmlData: [],
      htmlFactory: () => document.createElement("span"),
      htmlModifier: null,
      htmlRecords: [],
      pathColor: (path) => path.color || "rgba(112, 216, 255, 0.16)",
      pathStroke: (path) => path.stroke || 0.18,
      pointAltitude: (entry) => (entry.isCurrent ? 0.08 : 0.035),
      pointColor: (entry) => (entry.isCurrent ? "#ff4f9a" : "#8eea62"),
      pointRadius: pointRadiusForEntry,
      pov: { altitude: 2.45, lat: 18, lng: -126 },
      ringMaxRadius: 2.2,
      ringPropagationSpeed: prefersReducedMotion.matches ? 0 : 0.48,
      width: Math.max(320, Math.floor(element.getBoundingClientRect().width || 640)),
      zoomCallback: null,
    };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, state.width / state.height, 0.08, 120);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !window.matchMedia("(max-width: 700px)").matches,
      powerPreference: "high-performance",
    });
    const overlay = document.createElement("div");
    const earthGroup = new THREE.Group();
    const pointsGroup = new THREE.Group();
    const arcsGroup = new THREE.Group();
    const pathsGroup = new THREE.Group();
    const ringsGroup = new THREE.Group();
    const polygonGroup = new THREE.Group();
    const starGroup = new THREE.Group();
    const ambientLight = new THREE.AmbientLight(0xb8d7d0, 0.48);
    const hemiLight = new THREE.HemisphereLight(0x9ddcff, 0x112015, 0.82);
    const sunLight = new THREE.DirectionalLight(0xfff1d0, 1.52);
    const earthGeometry = new THREE.SphereGeometry(1, 96, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0xf4fff7,
      emissive: 0x06110d,
      emissiveIntensity: 0.035,
      shininess: 12,
      specular: 0x315a5f,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.045, 96, 64),
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: 0x70d8ff,
        depthWrite: false,
        opacity: 0.18,
        side: THREE.BackSide,
        transparent: true,
      })
    );
    const controls = {
      autoRotate: false,
      autoRotateSpeed: 0,
      enableDamping: true,
      enablePan: false,
      enableZoom: true,
    };
    const cleanup = [];
    let frame = 0;
    let lastFrameTime = 0;
    let textureToken = 0;
    let dragging = false;
    let dragStart = null;
    let pinchStart = null;
    let zoomEaseFrame = 0;
    let zoomTargetAltitude = state.pov.altitude;
    const activePointers = new Map();

    renderer.domElement.className = "sirui-three-globe-canvas";
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.45 : 1.9));
    renderer.setSize(state.width, state.height, false);
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
    }

    overlay.className = "sirui-globe-html-layer";
    element.append(renderer.domElement, overlay);

    sunLight.position.set(3.8, 1.7, 4.2);
    earthGroup.add(earthMesh, atmosphere);
    scene.add(starGroup, earthGroup, pointsGroup, arcsGroup, pathsGroup, ringsGroup, polygonGroup);
    scene.add(ambientLight, hemiLight, sunLight);

    const disposeObject = (object) => {
      object.traverse?.((child) => {
        child.geometry?.dispose?.();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value?.isTexture) value.dispose();
          });
          material.dispose?.();
        });
      });
    };

    const clearGroup = (group) => {
      while (group.children.length) {
        const child = group.children[0];
        group.remove(child);
        disposeObject(child);
      }
    };

    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      cleanup.push(() => target.removeEventListener(type, handler, options));
    };

    const buildStars = () => {
      const starCount = window.innerWidth < 700 ? 360 : 780;
      const positions = new Float32Array(starCount * 3);

      for (let index = 0; index < starCount; index += 1) {
        const radius = 22 + Math.random() * 38;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[index * 3 + 1] = radius * Math.cos(phi);
        positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: 0xd9fff3,
        opacity: 0.42,
        size: 0.045,
        sizeAttenuation: true,
        transparent: true,
      });
      starGroup.add(new THREE.Points(geometry, material));
    };

    const notifyZoom = () => {
      state.zoomCallback?.({ ...state.pov });
    };

    const setCameraFromPov = () => {
      const altitude = clamp(state.pov.altitude, globeInspectMinAltitude, 3.75);
      state.pov.altitude = altitude;
      state.pov.lat = clamp(state.pov.lat, -82, 82);
      state.pov.lng = normalizeLongitude(state.pov.lng);
      const position = latLngToThreeVector(THREE, state.pov.lat, state.pov.lng, 1 + altitude);
      camera.position.copy(position);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      updateHtmlPositions();
    };

    const makeLine = (points, colorValue, opacityMultiplier = 1) => {
      const { color, opacity } = cssColor(THREE, colorValue);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        blending: THREE.AdditiveBlending,
        color,
        depthWrite: false,
        opacity: clamp(opacity * opacityMultiplier, 0, 1),
        transparent: true,
      });

      return new THREE.Line(geometry, material);
    };

    const renderPoints = () => {
      clearGroup(pointsGroup);
      const geometry = new THREE.SphereGeometry(1, 24, 16);

      state.pointData?.forEach((entry) => {
        if (!hasCoordinates(entry)) return;

        const radius = typeof state.pointRadius === "function" ? Number(state.pointRadius(entry)) : Number(state.pointRadius) || 0.05;
        const altitude = typeof state.pointAltitude === "function" ? Number(state.pointAltitude(entry)) : Number(state.pointAltitude) || 0.04;
        const colorValue = typeof state.pointColor === "function" ? state.pointColor(entry) : state.pointColor;
        const { color } = cssColor(THREE, colorValue, "#8eea62");
        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: entry.isCurrent ? 1.25 : 0.64,
          metalness: 0.08,
          roughness: 0.34,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(latLngToThreeVector(THREE, entry.lat, entry.lng, 1 + altitude));
        mesh.scale.setScalar(clamp(radius, 0.012, 0.065));
        pointsGroup.add(mesh);
      });
    };

    const renderRings = () => {
      clearGroup(ringsGroup);
      state.ringData?.forEach((entry) => {
        if (!hasCoordinates(entry)) return;

        const normal = latLngToThreeVector(THREE, entry.lat, entry.lng, 1).normalize();
        const material = new THREE.MeshBasicMaterial({
          blending: THREE.AdditiveBlending,
          color: 0xff4f9a,
          depthWrite: false,
          opacity: 0.3,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 96), material);
        ring.position.copy(normal.clone().multiplyScalar(1.022));
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        ring.userData.maxScale = 1.65 + state.ringMaxRadius * 0.5;
        ringsGroup.add(ring);
      });
    };

    const renderArcs = () => {
      clearGroup(arcsGroup);
      state.arcData?.forEach((arc) => {
        const start = latLngToThreeVector(THREE, arc.startLat, arc.startLng, 1.035);
        const end = latLngToThreeVector(THREE, arc.endLat, arc.endLng, 1.035);
        const mid = start.clone().add(end).normalize().multiplyScalar(1.22);
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const colorValue = typeof state.arcColor === "function" ? state.arcColor(arc) : state.arcColor;
        const color = Array.isArray(colorValue) ? colorValue[colorValue.length - 1] : colorValue;
        const line = makeLine(curve.getPoints(72), color || "rgba(255, 79, 154, 0.32)", 1.25);
        arcsGroup.add(line);
      });
    };

    const renderPaths = () => {
      clearGroup(pathsGroup);
      state.pathData?.forEach((path) => {
        const points = (path.points || [])
          .filter(hasCoordinates)
          .map((point) => latLngToThreeVector(THREE, point.lat, point.lng, 1 + (Number(point.alt) || 0.012)));

        if (points.length < 2) return;

        const colorValue = typeof state.pathColor === "function" ? state.pathColor(path) : state.pathColor;
        const stroke = typeof state.pathStroke === "function" ? Number(state.pathStroke(path)) : Number(state.pathStroke) || 0.16;
        pathsGroup.add(makeLine(points, colorValue, clamp(0.68 + stroke, 0.2, 1.4)));
      });
    };

    const renderPolygons = () => {
      clearGroup(polygonGroup);
      const polygon = state.polygonData?.[0]?.geometry?.coordinates?.[0];
      if (!Array.isArray(polygon) || polygon.length < 3) return;

      const vertices = [new THREE.Vector3(0, 0, 0)];
      polygon.forEach(([lng, lat]) => {
        vertices.push(latLngToThreeVector(THREE, lat, lng, 1.006));
      });

      const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
      const indices = [];
      for (let index = 1; index < vertices.length - 1; index += 1) {
        indices.push(0, index, index + 1);
      }
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({
        color: 0x02050a,
        depthWrite: false,
        opacity: 0.18,
        side: THREE.DoubleSide,
        transparent: true,
      });
      polygonGroup.add(new THREE.Mesh(geometry, material));
    };

    const renderHtml = () => {
      overlay.replaceChildren();
      state.htmlRecords = (state.htmlData || []).filter(hasCoordinates).map((entry) => {
        const elementNode = state.htmlFactory(entry);
        overlay.append(elementNode);
        return { element: elementNode, entry };
      });
      window.requestAnimationFrame(() => setActiveMarker(activeMarkerId));
      updateHtmlPositions();
    };

    const updateHtmlPositions = () => {
      if (!state.htmlRecords.length || !state.width || !state.height) return;

      const cameraNormal = camera.position.clone().normalize();
      state.htmlRecords.forEach(({ element: marker, entry }) => {
        const altitude = entry.kind ? 0.16 : 0.09;
        const world = latLngToThreeVector(THREE, entry.lat, entry.lng, 1 + altitude);
        const normal = world.clone().normalize();
        const projected = world.clone().project(camera);
        const x = (projected.x * 0.5 + 0.5) * state.width;
        const y = (-projected.y * 0.5 + 0.5) * state.height;
        const isVisible =
          normal.dot(cameraNormal) > -0.08 &&
          projected.z > -1 &&
          projected.z < 1.08 &&
          x > -120 &&
          x < state.width + 120 &&
          y > -120 &&
          y < state.height + 120;

        marker.style.left = `${x.toFixed(1)}px`;
        marker.style.top = `${y.toFixed(1)}px`;
        if (state.htmlModifier) {
          state.htmlModifier(marker, isVisible);
        } else {
          marker.style.opacity = isVisible ? "" : "0";
          marker.style.pointerEvents = isVisible ? "auto" : "none";
        }
      });
    };

    const renderFrame = (now = performance.now()) => {
      if (state.disposed) return;

      const seconds = now / 1000;
      const delta = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.05) : 0;
      lastFrameTime = now;
      if (controls.autoRotate && !dragging && state.pov.altitude > 1.35) {
        state.pov.lng = normalizeLongitude(state.pov.lng + controls.autoRotateSpeed * delta);
        setCameraFromPov();
      }
      ringsGroup.children.forEach((ring, index) => {
        const speed = Math.max(0, state.ringPropagationSpeed || 0);
        const phase = speed ? (seconds * speed + index * 0.23) % 1 : 0.44;
        const scale = 0.9 + phase * (ring.userData.maxScale || 5);
        ring.scale.setScalar(scale);
        ring.material.opacity = speed ? (1 - phase) * 0.26 : 0.18;
      });
      atmosphere.material.opacity = 0.15 + Math.sin(seconds * 0.8) * 0.018;
      starGroup.rotation.y += delta * 0.006;
      renderer.render(scene, camera);
      updateHtmlPositions();
      frame = window.requestAnimationFrame(renderFrame);
    };

    const restartFrameLoop = () => {
      if (!frame && !state.disposed) {
        lastFrameTime = 0;
        frame = window.requestAnimationFrame(renderFrame);
      }
    };

    const stopFrameLoop = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const cancelZoomEase = () => {
      if (zoomEaseFrame) {
        window.cancelAnimationFrame(zoomEaseFrame);
        zoomEaseFrame = 0;
      }
      zoomTargetAltitude = state.pov.altitude;
    };

    const stepZoomEase = () => {
      zoomEaseFrame = 0;
      if (state.disposed) return;

      const difference = zoomTargetAltitude - state.pov.altitude;
      if (Math.abs(difference) <= 0.004) {
        if (Math.abs(difference) > 0.0001) {
          state.pov = { ...state.pov, altitude: zoomTargetAltitude };
          setCameraFromPov();
          notifyZoom();
        }
        return;
      }

      const ease = prefersReducedMotion.matches ? 1 : clamp(0.18 + Math.abs(difference) * 0.04, 0.18, 0.3);
      state.pov = {
        ...state.pov,
        altitude: state.pov.altitude + difference * ease,
      };
      setCameraFromPov();
      notifyZoom();
      zoomEaseFrame = window.requestAnimationFrame(stepZoomEase);
    };

    const scheduleZoomEase = () => {
      if (!zoomEaseFrame) {
        zoomEaseFrame = window.requestAnimationFrame(stepZoomEase);
      }
    };

    const pointerDistance = () => {
      const pointers = Array.from(activePointers.values());
      if (pointers.length < 2) return 0;

      return Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
    };

    const setPointerCaptureSafely = (event) => {
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic or interrupted touch streams may not own pointer capture.
      }
    };

    const releasePointerCaptureSafely = (event) => {
      try {
        renderer.domElement.releasePointerCapture?.(event.pointerId);
      } catch {
        // Synthetic or interrupted touch streams may not own pointer capture.
      }
    };

    const moveToPov = (nextPov, duration = 0) => {
      if (!nextPov) return;

      cancelZoomEase();
      const target = {
        altitude: clamp(Number(nextPov.altitude) || state.pov.altitude, globeInspectMinAltitude, 3.75),
        lat: clamp(toFiniteNumber(nextPov.lat) ?? state.pov.lat, -82, 82),
        lng: normalizeLongitude(toFiniteNumber(nextPov.lng) ?? state.pov.lng),
      };
      const start = { ...state.pov };
      const deltaLng = normalizeLongitude(target.lng - start.lng);
      const animationId = ++state.activeAnimation;
      const transitionMs = prefersReducedMotion.matches ? 0 : Math.max(Number(duration) || 0, 0);
      const startedAt = performance.now();

      if (!transitionMs) {
        state.pov = target;
        zoomTargetAltitude = target.altitude;
        setCameraFromPov();
        notifyZoom();
        return;
      }

      const step = (now) => {
        if (state.disposed || animationId !== state.activeAnimation) return;

        const progress = smoothStep((now - startedAt) / transitionMs);
        state.pov = {
          altitude: lerp(start.altitude, target.altitude, progress),
          lat: lerp(start.lat, target.lat, progress),
          lng: normalizeLongitude(start.lng + deltaLng * progress),
        };
        zoomTargetAltitude = state.pov.altitude;
        setCameraFromPov();
        notifyZoom();
        if (progress < 1) window.requestAnimationFrame(step);
      };

      window.requestAnimationFrame(step);
    };

    const handlePointerDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;

      cancelZoomEase();
      activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      dragging = true;
      dragStart = {
        lat: state.pov.lat,
        lng: state.pov.lng,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      state.activeAnimation += 1;
      element.classList.add("is-dragging");
      setPointerCaptureSafely(event);

      if (activePointers.size >= 2) {
        const distance = pointerDistance();
        pinchStart = {
          altitude: state.pov.altitude,
          distance: distance || 1,
        };
        dragging = false;
        dragStart = null;
      }
    };

    const handlePointerMove = (event) => {
      if (activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      }

      if (pinchStart && activePointers.size >= 2) {
        const distance = pointerDistance();
        const ratio = distance > 0 ? distance / pinchStart.distance : 1;
        zoomTargetAltitude = clamp(pinchStart.altitude / Math.pow(Math.max(ratio, 0.18), 0.9), globeInspectMinAltitude, 3.75);
        scheduleZoomEase();
        return;
      }

      if (!dragging || !dragStart) return;

      const altitudeFactor = clamp(state.pov.altitude / 2.3, 0.54, 1.24);
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      state.pov = {
        altitude: state.pov.altitude,
        lat: clamp(dragStart.lat + dy * 0.16 * altitudeFactor, -82, 82),
        lng: normalizeLongitude(dragStart.lng - dx * 0.2 * altitudeFactor),
      };
      zoomTargetAltitude = state.pov.altitude;
      setCameraFromPov();
      notifyZoom();
    };

    const handlePointerUp = (event) => {
      activePointers.delete(event.pointerId);
      releasePointerCaptureSafely(event);

      if (pinchStart && activePointers.size === 1) {
        const [pointerId, pointer] = Array.from(activePointers.entries())[0];
        pinchStart = null;
        dragging = true;
        dragStart = {
          lat: state.pov.lat,
          lng: state.pov.lng,
          pointerId,
          x: pointer.x,
          y: pointer.y,
        };
        return;
      }

      if (activePointers.size > 0) return;

      pinchStart = null;
      dragging = false;
      dragStart = null;
      element.classList.remove("is-dragging");
    };

    const handleWheel = (event) => {
      if (!controls.enableZoom) return;

      event.preventDefault();
      state.activeAnimation += 1;
      const modeScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 96 : 1;
      const delta = clamp(event.deltaY * modeScale, -900, 900);
      zoomTargetAltitude = clamp(zoomTargetAltitude + delta * globeWheelZoomSensitivity, globeInspectMinAltitude, 3.75);
      scheduleZoomEase();
    };

    on(renderer.domElement, "pointerdown", handlePointerDown);
    on(renderer.domElement, "pointermove", handlePointerMove);
    on(renderer.domElement, "pointerup", handlePointerUp);
    on(renderer.domElement, "pointercancel", handlePointerUp);
    on(element, "wheel", handleWheel, { passive: false });

    buildStars();
    setCameraFromPov();
    restartFrameLoop();

    const api = {
      arcColor(value) {
        state.arcColor = value;
        renderArcs();
        return api;
      },
      arcStroke(value) {
        state.arcStroke = value;
        renderArcs();
        return api;
      },
      arcsData(value) {
        state.arcData = value || [];
        renderArcs();
        return api;
      },
      backgroundColor() {
        return api;
      },
      bumpImageUrl(url) {
        const token = textureToken;
        if (!url) return api;

        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin("anonymous");
        loader.load(
          url,
          (texture) => {
            if (state.disposed || token !== textureToken) {
              texture.dispose();
              return;
            }
            earthMaterial.bumpMap = texture;
            earthMaterial.bumpScale = 0.018;
            earthMaterial.needsUpdate = true;
          },
          undefined,
          () => {}
        );
        return api;
      },
      camera() {
        return camera;
      },
      controls() {
        return controls;
      },
      dispose() {
        state.disposed = true;
        cancelZoomEase();
        stopFrameLoop();
        cleanup.forEach((remove) => remove());
        element.classList.remove("is-dragging");
        overlay.remove();
        renderer.domElement.remove();
        renderer.dispose();
        disposeObject(scene);
      },
      globeImageUrl(url) {
        textureToken += 1;
        const token = textureToken;
        if (!url) return api;

        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin("anonymous");
        loader.load(
          url,
          (texture) => {
            if (state.disposed || token !== textureToken) {
              texture.dispose();
              return;
            }
            texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 1, 8);
            if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
            earthMaterial.map = texture;
            earthMaterial.needsUpdate = true;
          },
          undefined,
          () => {
            if (url !== globeFallbackTextureUrl && globeFallbackTextureUrl) {
              api.globeImageUrl(globeFallbackTextureUrl);
            }
          }
        );
        return api;
      },
      globeMaterial() {
        return earthMaterial;
      },
      height(value) {
        state.height = Math.max(320, Math.floor(value || state.height));
        renderer.setSize(state.width, state.height, false);
        camera.aspect = state.width / state.height;
        camera.updateProjectionMatrix();
        updateHtmlPositions();
        return api;
      },
      htmlElement(value) {
        state.htmlFactory = value;
        renderHtml();
        return api;
      },
      htmlElementVisibilityModifier(value) {
        state.htmlModifier = value;
        updateHtmlPositions();
        return api;
      },
      htmlElementsData(value) {
        state.htmlData = value || [];
        renderHtml();
        return api;
      },
      lights() {
        return [ambientLight, hemiLight, sunLight];
      },
      onZoom(value) {
        state.zoomCallback = value;
        return api;
      },
      pathColor(value) {
        state.pathColor = value;
        renderPaths();
        return api;
      },
      pathStroke(value) {
        state.pathStroke = value;
        renderPaths();
        return api;
      },
      pathsData(value) {
        state.pathData = value || [];
        renderPaths();
        return api;
      },
      pauseAnimation() {
        stopFrameLoop();
        return api;
      },
      pointAltitude(value) {
        state.pointAltitude = value;
        renderPoints();
        return api;
      },
      pointColor(value) {
        state.pointColor = value;
        renderPoints();
        return api;
      },
      pointOfView(value, duration) {
        if (!value) return { ...state.pov };

        moveToPov(value, duration);
        return api;
      },
      pointRadius(value) {
        state.pointRadius = value;
        renderPoints();
        return api;
      },
      pointsData(value) {
        state.pointData = value || [];
        renderPoints();
        return api;
      },
      polygonsData(value) {
        state.polygonData = value || [];
        renderPolygons();
        return api;
      },
      renderer() {
        return renderer;
      },
      resumeAnimation() {
        restartFrameLoop();
        return api;
      },
      ringMaxRadius(value) {
        state.ringMaxRadius = Number(value) || state.ringMaxRadius;
        renderRings();
        return api;
      },
      ringPropagationSpeed(value) {
        state.ringPropagationSpeed = Number(value) || 0;
        return api;
      },
      ringsData(value) {
        state.ringData = value || [];
        renderRings();
        return api;
      },
      showAtmosphere(value) {
        atmosphere.visible = value !== false;
        return api;
      },
      width(value) {
        state.width = Math.max(320, Math.floor(value || state.width));
        renderer.setSize(state.width, state.height, false);
        camera.aspect = state.width / state.height;
        camera.updateProjectionMatrix();
        updateHtmlPositions();
        return api;
      },
    };

    [
      "animateIn",
      "arcAltitudeAutoScale",
      "arcCircularResolution",
      "arcCurveResolution",
      "arcDashAnimateTime",
      "arcDashGap",
      "arcDashLength",
      "arcEndLat",
      "arcEndLng",
      "arcLabel",
      "arcStartLat",
      "arcStartLng",
      "atmosphereAltitude",
      "atmosphereColor",
      "globeCurvatureResolution",
      "htmlAltitude",
      "htmlLat",
      "htmlLng",
      "htmlTransitionDuration",
      "pathDashAnimateTime",
      "pathDashGap",
      "pathDashLength",
      "pathPointAlt",
      "pathPointLat",
      "pathPointLng",
      "pathPoints",
      "pathResolution",
      "pathTransitionDuration",
      "pointLabel",
      "pointLat",
      "pointLng",
      "pointResolution",
      "pointsTransitionDuration",
      "polygonAltitude",
      "polygonCapColor",
      "polygonCapCurvatureResolution",
      "polygonGeoJsonGeometry",
      "polygonSideColor",
      "polygonStrokeColor",
      "polygonsTransitionDuration",
      "ringAltitude",
      "ringColor",
      "ringLat",
      "ringLng",
      "ringRepeatPeriod",
      "ringResolution",
    ].forEach((method) => {
      api[method] = () => api;
    });

    return api;
  };

  const streetZoomRangeForEntry = (entry) => {
    const zoom = clampStreetZoom(streetViewZoomForEntry(entry));
    return [zoom, zoom];
  };

  const altitudeToStreetZoom = (_altitude, entry) => clampStreetZoom(streetViewZoomForEntry(entry));

  const streetZoomToAltitude = (zoom, entry) => {
    const [minZoom, maxZoom] = streetZoomRangeForEntry(entry);
    const progress = clamp((zoom - minZoom) / Math.max(maxZoom - minZoom, 1), 0, 1);

    return altitudeForStreetMorphProgress(progress);
  };

  const updateStreetReadout = () => {};

  const setStreetMapInteraction = (enabled) => {
    if (!streetMapInstance) return;

    const method = enabled ? "enable" : "disable";
    ["boxZoom", "doubleClickZoom", "dragging", "keyboard", "scrollWheelZoom", "tap", "touchZoom"].forEach((handler) => {
      streetMapInstance[handler]?.[method]?.();
    });
    streetMapElement?.classList.toggle("is-interactive", enabled);
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

  const setStreetTileStatus = (visible, message = "Map tiles did not load here. Zoom out slightly.") => {
    if (!streetMapStatus) return;

    streetMapStatus.textContent = message;
    streetMapStatus.hidden = !visible;
    streetMapElement?.classList.toggle("has-tile-warning", visible);
  };

  const resetStreetTileStatus = () => {
    streetTileErrorCount = 0;
    streetTileLoadCount = 0;
    setStreetTileStatus(false);
  };

  const handleStreetTileLoad = () => {
    streetTileLoadCount += 1;
    if (streetTileLoadCount > 0) {
      setStreetTileStatus(false);
    }
  };

  const handleStreetTileError = () => {
    streetTileErrorCount += 1;
    if (streetTileErrorCount >= 2) {
      setStreetTileStatus(true);
    }
  };

  const viewportSize = () => ({
    height: window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 720,
    width: window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 1024,
  });

  const clampPixels = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

  const morphMetrics = () => {
    const rect = mapStage?.getBoundingClientRect();
    const viewport = viewportSize();
    const compact = viewport.width <= 820;
    const globeRect = globeElement?.getBoundingClientRect();
    const stageWidth = Math.max(rect?.width || globeElement?.clientWidth || 1, 1);
    const stageHeight = Math.max(compact ? globeRect?.height || globeElement?.clientHeight || 1 : rect?.height || globeElement?.clientHeight || 1, 1);
    const narrow = viewport.width <= 480;
    const margin = narrow ? 7 : compact ? 8 : 12;
    const streetInsetWidth = narrow
      ? clampPixels(viewport.width * 0.34, 104, 136)
      : compact
        ? Math.min(256, stageWidth - margin * 2)
        : Math.min(352, viewport.width * 0.38, stageWidth - margin * 2);
    const streetInsetHeight = narrow
      ? clampPixels(viewport.height * 0.16, 75, 93)
      : compact
        ? clampPixels(viewport.height * 0.24, 96, 128)
        : clampPixels(viewport.height * 0.24, 136, 208);
    const globeInsetWidth = narrow ? clampPixels(viewport.width * 0.28, 96, 128) : Math.min(304, viewport.width * 0.36, stageWidth - margin * 2);
    const globeInsetHeight = narrow ? clampPixels(viewport.height * 0.2, 76, 106) : clampPixels(viewport.height * 0.24, 136, 208);

    return {
      globeInsetHeight: Math.min(globeInsetHeight, stageHeight - margin * 2),
      globeInsetWidth: Math.min(globeInsetWidth, stageWidth - margin * 2),
      margin,
      stageHeight,
      stageWidth,
      streetInsetHeight: Math.min(streetInsetHeight, stageHeight - margin * 2),
      streetInsetWidth: Math.min(streetInsetWidth, stageWidth - margin * 2),
    };
  };

  const setPixelVariable = (name, value) => {
    mapStage?.style.setProperty(name, `${Math.max(0, Math.round(value))}px`);
  };

  const invalidateStreetMapSoon = () => {
    if (streetInvalidateFrame) return;

    streetInvalidateFrame = window.requestAnimationFrame(() => {
      streetInvalidateFrame = 0;
      streetMapInstance?.invalidateSize?.(false);
      resizeGlobe();
    });
  };

  const invalidateStreetMapSettled = () => {
    invalidateStreetMapSoon();

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        streetMapInstance?.invalidateSize?.(false);
        resizeGlobe();
      });
    });

    if (streetInvalidateSettleTimer) {
      window.clearTimeout(streetInvalidateSettleTimer);
    }
    streetInvalidateSettleTimer = window.setTimeout(() => {
      streetInvalidateSettleTimer = 0;
      streetMapInstance?.invalidateSize?.(false);
      resizeGlobe();
    }, streetTransitionMs + 80);
  };

  const updateStreetMorphLayout = (progress, { visible = true, settled = false } = {}) => {
    const value = clamp(progress, 0, 1);
    const metrics = morphMetrics();
    const globeProgress = smoothStep((value - globeInsetStartProgress) / Math.max(1 - globeInsetStartProgress, 0.01));
    const streetX = lerp(metrics.stageWidth - metrics.streetInsetWidth - metrics.margin, 0, value);
    const streetY = lerp(metrics.stageHeight - metrics.streetInsetHeight - metrics.margin, 0, value);
    const streetWidth = lerp(metrics.streetInsetWidth, metrics.stageWidth, value);
    const streetHeight = lerp(metrics.streetInsetHeight, metrics.stageHeight, value);
    const globeX = lerp(0, metrics.stageWidth - metrics.globeInsetWidth - metrics.margin, globeProgress);
    const globeY = lerp(0, metrics.stageHeight - metrics.globeInsetHeight - metrics.margin, globeProgress);
    const globeWidth = lerp(metrics.stageWidth, metrics.globeInsetWidth, globeProgress);
    const globeHeight = lerp(metrics.stageHeight, metrics.globeInsetHeight, globeProgress);
    const labelFade = 1 - smoothStep((value - 0.18) / 0.46);

    streetMorphProgress = value;
    mapStage?.style.setProperty("--sirui-street-morph", value.toFixed(3));
    mapStage?.style.setProperty("--sirui-street-opacity", (0.92 + value * 0.08).toFixed(3));
    mapStage?.style.setProperty("--sirui-street-header-opacity", (0.72 + smoothStep((value - 0.12) / 0.44) * 0.28).toFixed(3));
    mapStage?.style.setProperty("--sirui-street-controls-opacity", smoothStep((value - 0.52) / 0.36).toFixed(3));
    mapStage?.style.setProperty("--sirui-globe-opacity", (1 - globeProgress * 0.08).toFixed(3));
    mapStage?.style.setProperty("--sirui-globe-label-opacity", labelFade.toFixed(3));
    mapStage?.style.setProperty("--sirui-globe-label-y", `${(1 - labelFade) * 0.3}rem`);
    mapStage?.style.setProperty("--sirui-street-z", value > 0.04 ? "5" : "4");
    mapStage?.style.setProperty("--sirui-globe-z", globeProgress > 0.82 ? "6" : "3");
    setPixelVariable("--sirui-street-x", streetX);
    setPixelVariable("--sirui-street-y", streetY);
    setPixelVariable("--sirui-street-width", streetWidth);
    setPixelVariable("--sirui-street-height", streetHeight);
    setPixelVariable("--sirui-globe-x", globeX);
    setPixelVariable("--sirui-globe-y", globeY);
    setPixelVariable("--sirui-globe-width", globeWidth);
    setPixelVariable("--sirui-globe-height", globeHeight);
    mapStage?.classList.toggle("is-street-morphing", visible);
    mapStage?.classList.toggle("is-street-dominant", visible && value >= streetMainExitProgress);
    mapStage?.classList.toggle("is-globe-inset", visible && globeProgress > 0.5);
    mapStage?.classList.toggle("is-globe-main", !visible || globeProgress <= 0.5);
    invalidateStreetMapSoon();
    if (settled) invalidateStreetMapSettled();
  };

  const shouldSkipStreetMapSync = (lat, lng, zoom, force) => {
    const referenceView = streetZoomGlideTarget || lastStreetSyncView;
    if (force || !referenceView) return false;

    const sameZoom = Math.abs((referenceView.zoom || 0) - zoom) < 0.1;
    const sameLat = Math.abs((referenceView.lat || 0) - lat) < 0.00002;
    const sameLng = Math.abs((referenceView.lng || 0) - lng) < 0.00002;

    return sameZoom && sameLat && sameLng;
  };

  const cancelStreetZoomGlide = () => {
    streetZoomGlideToken += 1;
    streetZoomGlideTarget = null;
    if (streetZoomGlideTimer) {
      window.clearTimeout(streetZoomGlideTimer);
      streetZoomGlideTimer = 0;
    }
  };

  const applyStreetMapView = (streetMap, lat, lng, zoom, entry) => {
    const safeZoom = clampStreetZoom(zoom);
    streetMap.setView([lat, lng], safeZoom, {
      animate: false,
    });
    lastStreetSyncAt = performance.now();
    lastStreetSyncView = { lat, lng, zoom: safeZoom };
    invalidateStreetMapSoon();
    updateStreetReadout(entry);
  };

  const glideStreetMapTo = (streetMap, lat, lng, zoom, { entry, force = false } = {}) => {
    const targetZoom = clampStreetZoom(zoom);
    let currentCenter = null;
    let currentZoom = null;

    try {
      if (streetMap?._loaded) {
        currentCenter = streetMap.getCenter?.();
        currentZoom = streetMap.getZoom?.();
      }
    } catch {
      currentCenter = null;
      currentZoom = null;
    }

    const fallbackView = lastStreetSyncView || streetZoomGlideTarget;
    const startLat = toFiniteNumber(currentCenter?.lat) ?? toFiniteNumber(fallbackView?.lat) ?? lat;
    const startLng = toFiniteNumber(currentCenter?.lng) ?? toFiniteNumber(fallbackView?.lng) ?? lng;
    const startZoom = clampStreetZoom(toFiniteNumber(currentZoom) ?? toFiniteNumber(fallbackView?.zoom) ?? targetZoom);
    const zoomDelta = Math.abs(startZoom - targetZoom);
    const distanceDelta = Math.max(Math.abs(startLat - lat), Math.abs(startLng - lng));
    const shouldGlide =
      !force &&
      !prefersReducedMotion.matches &&
      (zoomDelta > 0.45 || distanceDelta > 0.002) &&
      activeViewMode === "visitor" &&
      Boolean(streetMap?._loaded || fallbackView);

    cancelStreetZoomGlide();
    streetZoomGlideTarget = { lat, lng, zoom: targetZoom };

    if (!shouldGlide) {
      setSyncSource("globe", force ? 420 : 240);
      applyStreetMapView(streetMap, lat, lng, targetZoom, entry);
      streetZoomGlideTarget = null;
      return;
    }

    const duration = clamp(320 + zoomDelta * 110, 380, 900);
    const token = streetZoomGlideToken;
    let started = 0;

    setSyncSource("globe", duration + 180);

    const scheduleStep = () => {
      streetZoomGlideTimer = window.setTimeout(() => step(performance.now()), 48);
    };

    const step = (now) => {
      streetZoomGlideTimer = 0;
      if (token !== streetZoomGlideToken || syncSource === "street") return;

      if (!started) started = now;
      const progress = smoothStep((now - started) / duration);
      const nextLat = lerp(startLat, lat, progress);
      const nextLng = lerp(startLng, lng, progress);
      const nextZoom = lerp(startZoom, targetZoom, progress);

      applyStreetMapView(streetMap, nextLat, nextLng, nextZoom, entry);

      if (progress < 1) {
        scheduleStep();
        return;
      }

      streetZoomGlideTarget = null;
      invalidateStreetMapSettled();
    };

    scheduleStep();
  };

  const ensureStreetMap = async (entry) => {
    if (!streetMapElement || !hasCoordinates(entry)) return null;

    const L = await waitForLeaflet();
    if (!L) return null;

    if (!streetMapInstance) {
      streetMapInstance = L.map(streetMapElement, {
        attributionControl: true,
        boxZoom: false,
        doubleClickZoom: false,
        dragging: false,
        keyboard: false,
        maxZoom: streetMapMaxZoom,
        minZoom: streetMapMinZoom,
        scrollWheelZoom: false,
        tap: false,
        touchZoom: false,
        wheelPxPerZoomLevel: 90,
        zoomControl: true,
        zoomSnap: 0.1,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        detectRetina: false,
        errorTileUrl: streetErrorTileUrl,
        maxNativeZoom: streetMapMaxZoom,
        maxZoom: streetMapMaxZoom,
        minZoom: streetMapMinZoom,
      })
        .on("loading", resetStreetTileStatus)
        .on("tileload", handleStreetTileLoad)
        .on("tileerror", handleStreetTileError)
        .addTo(streetMapInstance);
      streetMapInstance.on("zoomstart movestart", resetStreetTileStatus);
      ["boxZoom", "doubleClickZoom", "dragging", "keyboard", "scrollWheelZoom", "tap", "touchZoom"].forEach((handler) => {
        streetMapInstance[handler]?.disable?.();
      });
    }

    updateStreetMarker(entry);
    setStreetMapInteraction(streetViewActive && streetMainActive);
    return streetMapInstance;
  };

  const syncStreetMapFromGlobe = async (entry, pov, { force = false } = {}) => {
    if (!hasCoordinates(entry) || entry?.kind || !isStreetSyncedMode()) return false;
    if (syncSource === "street" && !force) return false;

    if (streetMapPanel) streetMapPanel.hidden = false;
    const streetMap = await ensureStreetMap(entry);
    if (!streetMap) return false;

    const effectivePov = !force ? activeStreetFocusTarget() || pov : pov;
    const centerLat = toFiniteNumber(effectivePov?.lat) ?? Number(entry.lat);
    const centerLng = toFiniteNumber(effectivePov?.lng) ?? Number(entry.lng);
    const zoom = altitudeToStreetZoom(Number(effectivePov?.altitude) || currentGlobeAltitude, entry);
    if (shouldSkipStreetMapSync(centerLat, centerLng, zoom, force)) return true;

    streetMapTitle.textContent = whereLabel(entry);
    glideStreetMapTo(streetMap, centerLat, centerLng, zoom, { entry, force });
    return true;
  };

  const scheduleStreetMapSync = (entry, pov, { force = false } = {}) => {
    if (!hasCoordinates(entry) || entry?.kind || !isStreetSyncedMode() || globeSyncLocked || syncSource === "street") {
      return;
    }

    pendingStreetSync = {
      entry,
      force: force || Boolean(pendingStreetSync?.force),
      pov,
    };

    if (force) {
      if (streetSyncTimeout) {
        window.clearTimeout(streetSyncTimeout);
        streetSyncTimeout = 0;
      }
      if (streetSyncFrame) {
        window.cancelAnimationFrame(streetSyncFrame);
        streetSyncFrame = 0;
      }
    }

    if (streetSyncFrame || streetSyncTimeout) return;

    const runSync = () => {
      const sync = pendingStreetSync;
      pendingStreetSync = null;
      streetSyncFrame = 0;
      streetSyncTimeout = 0;
      if (!sync) return;

      void syncStreetMapFromGlobe(sync.entry, sync.pov, { force: sync.force });
    };

    const elapsed = performance.now() - lastStreetSyncAt;
    const delay = force ? 0 : Math.max(0, streetSyncThrottleMs - elapsed);
    const scheduleFrame = () => {
      streetSyncFrame = window.requestAnimationFrame(runSync);
    };

    if (delay > 0) {
      streetSyncTimeout = window.setTimeout(scheduleFrame, delay);
    } else {
      scheduleFrame();
    }
  };

  const setStreetMapVisible = (visible, { full = false, progress = streetMorphProgress, settled = false } = {}) => {
    const isFull = Boolean(visible && full);
    const isInset = Boolean(visible && !full);

    if (streetMapPanel && visible) streetMapPanel.hidden = false;
    mapStage?.classList.toggle("is-street-mode", isFull);
    mapStage?.classList.toggle("is-street-main", isFull);
    mapStage?.classList.toggle("is-street-inset-mode", isInset);
    mapStage?.classList.toggle("is-street-inset", isInset);
    setStreetMapInteraction(isFull);
    updateStreetMorphLayout(visible ? progress : 0, { settled, visible });

    if (streetMapPanel && !visible) {
      window.setTimeout(
        () => {
          if (
            !mapStage?.classList.contains("is-street-morphing") &&
            !mapStage?.classList.contains("is-street-inset") &&
            !mapStage?.classList.contains("is-street-main")
          ) {
            streetMapPanel.hidden = true;
          }
        },
        prefersReducedMotion.matches ? 0 : 180
      );
    }
  };

  const setStreetPresentation = (full, { force = false, pov = null, sync = true } = {}) => {
    if (!isStreetSyncedMode()) {
      streetMainActive = false;
      streetPresentationTarget = false;
      streetPresentationToken += 1;
      setStreetMapVisible(false);
      return;
    }

    const entry = focusedGlobeEntry || activeVisitorEntry();
    if (!hasCoordinates(entry)) {
      streetMainActive = false;
      streetPresentationTarget = false;
      streetPresentationToken += 1;
      setStreetMapVisible(false);
      return;
    }

    const syncPov = pov || {
      altitude: currentGlobeAltitude,
      lat: entry.lat,
      lng: entry.lng,
    };
    const progress = streetMorphProgressForAltitude(syncPov.altitude);
    const nextFull = Boolean(full);
    const semanticChanged = streetMainActive !== nextFull || streetPresentationTarget !== nextFull;

    if (!force && streetMainActive === nextFull && streetPresentationTarget === nextFull) {
      setStreetMapVisible(true, {
        full: streetMainActive,
        progress,
        settled: false,
      });
      updateStreetReadout(entry);
      return;
    }

    streetPresentationTarget = nextFull;
    streetMainActive = nextFull;
    streetPresentationToken += semanticChanged || force ? 1 : 0;
    if (streetMapPanel) streetMapPanel.hidden = false;
    setStreetMapVisible(true, {
      full: nextFull,
      progress,
      settled: semanticChanged || force,
    });
    updateStreetReadout(entry);
    if (force && sync) void syncStreetMapFromGlobe(entry, syncPov, { force: true });
  };

  const applyZoomMode = (pov, activeEntry) => {
    const altitude = Number(pov?.altitude) || 2.4;
    const isFar = altitude > 2.35;
    const isNear = altitude <= 1.42;
    const focusEntry = focusedGlobeEntry || activeEntry;
    const focusPov = hasCoordinates(focusEntry)
      ? {
          altitude,
          lat: toFiniteNumber(pov?.lat) ?? Number(focusEntry.lat),
          lng: toFiniteNumber(pov?.lng) ?? Number(focusEntry.lng),
        }
      : null;

    currentGlobeAltitude = altitude;
    mapStage?.classList.toggle("is-zoom-far", isFar);
    mapStage?.classList.toggle("is-zoom-mid", !isFar && !isNear);
    mapStage?.classList.toggle("is-zoom-near", isNear);
    refreshGlobeMarkerScale();

    if (focusPov && isStreetSyncedMode()) {
      if (streetViewActive) {
        scheduleStreetMapSync(focusEntry, focusPov);
      } else if (
        mapStage?.classList.contains("is-street-inset") ||
        mapStage?.classList.contains("is-street-morphing") ||
        mapStage?.classList.contains("is-street-main") ||
        mapStage?.classList.contains("is-street-inset-mode")
      ) {
        setStreetMapVisible(false);
      }
    }

    if (streetViewActive && !detailsPinned) {
      hideMarkerDetails();
    } else if (isNear && hasCoordinates(focusEntry) && !detailsPinned) {
      setActiveMarker(focusEntry.id);
      if (markerCard) markerCard.hidden = true;
    } else if (!detailsPinned && !isNear) {
      hideMarkerDetails();
    }
  };

  const activeVisitorEntry = () => {
    const entry = lastUnlockRecord?.activeEntry || focusedGlobeEntry;
    return entry ? normalizeEntry(entry) : null;
  };

  const setViewMode = (mode, { animate = true } = {}) => {
    if (mode === "street") mode = "visitor";

    const visitorEntry = activeVisitorEntry();
    if (!visitorEntry && !["sun", "moon", "orbit"].includes(mode)) return;

    activeViewMode = mode;
    viewModeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.siruiView === mode);
    });

    const transitionMs = prefersReducedMotion.matches || !animate ? 0 : 900;
    const skySnapshot = lastSkySnapshot || {
      date: getSimulatedDate(),
      moonEntry: makeMoonEntry(getSimulatedDate()),
      moonPhase: getMoonPhase(getSimulatedDate()),
      sunEntry: makeSunEntry(getSimulatedDate()),
    };

    exitStreetView({ focusGlobe: false });
    mapStage?.classList.toggle("is-sky-mode", isSkyViewMode(mode));
    updateStreetReadout(visitorEntry);

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
        transitionMs
      );
      setGlobeStatus(`Visitor globe centered near ${whereLabel(visitorEntry)}. Click the marker for the reveal.`);
    } else if (mode === "sun") {
      focusedGlobeEntry = skySnapshot.sunEntry;
      clearPinnedDetails();
      updateSkyCockpit(skySnapshot);
      globeInstance?.pointOfView(
        {
          altitude: 2.05,
          lat: skySnapshot.sunEntry.lat,
          lng: skySnapshot.sunEntry.lng,
        },
        transitionMs
      );
      setGlobeStatus("Sun cockpit facing the subsolar point.");
    } else if (mode === "moon") {
      focusedGlobeEntry = skySnapshot.moonEntry;
      clearPinnedDetails();
      updateSkyCockpit(skySnapshot);
      globeInstance?.pointOfView(
        {
          altitude: 2.05,
          lat: skySnapshot.moonEntry.lat,
          lng: skySnapshot.moonEntry.lng,
        },
        transitionMs
      );
      setGlobeStatus("Moon cockpit facing the sublunar point.");
    } else if (mode === "orbit") {
      focusedGlobeEntry = visitorEntry || skySnapshot.sunEntry;
      clearPinnedDetails();
      updateSkyCockpit(skySnapshot);
      globeInstance?.pointOfView(
        {
          altitude: 3.35,
          lat: 10,
          lng: skySnapshot.moonEntry.lng,
        },
        transitionMs
      );
      setGlobeStatus("Orbit view showing a stylized Earth-Moon scale cue.");
    }

    if (isSkyViewMode(mode)) updateSunSystemOnce({ forceLayers: true });
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

  const updateGlobeAnimationState = () => {
    if (!globeInstance) return;

    if (document.hidden) {
      globeInstance.pauseAnimation?.();
    } else {
      globeInstance.resumeAnimation?.();
    }
  };

  const renderGlobe = async (entries, activeEntry) => {
    if (!globeElement || !hasWebGl()) return false;

    mapStage?.classList.remove("is-globe-ready");
    mapStage?.classList.add("is-globe-prepping");
    const THREE = await waitForThree();
    if (!THREE) {
      mapStage?.classList.remove("is-globe-prepping");
      return false;
    }

    try {
      markerLayer?.replaceChildren();
      stopSunTimer();
      if (mapFallback) mapFallback.hidden = true;
      globeElement.classList.remove("is-fallback");
      globeInstance?.dispose?.();
      globeElement.replaceChildren();
      if (globeResizeObserver) globeResizeObserver.disconnect();

      const activePoint = hasCoordinates(activeEntry) ? activeEntry : entries.find(hasCoordinates);
      const reducedMotion = prefersReducedMotion.matches;
      currentGlobeEntries = entries;
      const globe = createSiruiThreeGlobe(THREE, globeElement);

      globeInstance = globe;
      resizeGlobe();

      globe
        .backgroundColor("rgba(0, 0, 0, 0)")
        .showAtmosphere(true)
        .atmosphereColor("#70d8ff")
        .atmosphereAltitude(0.13)
        .globeCurvatureResolution(0.65)
        .pointsData(entries)
        .pointLat("lat")
        .pointLng("lng")
        .pointAltitude((entry) => (entry.isCurrent ? 0.08 : 0.035))
        .pointRadius(pointRadiusForEntry)
        .pointResolution(24)
        .pointColor((entry) => (entry.isCurrent ? "#ff4f9a" : "#8eea62"))
        .pointLabel((entry) => whereLabel(entry))
        .pointsTransitionDuration(0)
        .ringsData(activePoint ? [activePoint] : [])
        .ringLat("lat")
        .ringLng("lng")
        .ringAltitude(0.012)
        .ringColor(() => "rgba(255, 79, 154, 0.42)")
        .ringMaxRadius(2.2)
        .ringPropagationSpeed(0)
        .ringRepeatPeriod(0)
        .ringResolution(96)
        .arcsData([])
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
        .htmlTransitionDuration(0)
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
      configureNightShade(globe, reducedMotion);
      setGlobeVisualMotion(globe, reducedMotion, false);

      const controls = globe.controls?.();
      if (controls) {
        controls.autoRotate = false;
        controls.autoRotateSpeed = 0;
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.enableZoom = true;
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
            altitude: 2.45,
            lat: activePoint.lat,
            lng: activePoint.lng,
          },
          0
        );
      }

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (globeInstance !== globe) return;

          setGlobeVisualMotion(globe, reducedMotion, true);
          globe.arcsData?.(buildUnlockArcs(currentGlobeEntries, activeEntry));
          mapStage?.classList.remove("is-globe-prepping");
          mapStage?.classList.add("is-globe-ready");
          startSunSystem({ deferFirstUpdate: true });
          updateGlobeAnimationState();
        });
      });

      setGlobeStatus(
        activePoint ? `Signal acquired near ${whereLabel(activePoint)}.` : "Signal acquired, but this timezone is not on the where-ish map yet."
      );

      return true;
    } catch (error) {
      stopSunTimer();
      mapStage?.classList.remove("is-globe-prepping");
      console.warn("secret page globe failed", error);
      return false;
    }
  };

  const renderFallbackMap = (entries) => {
    if (!globeElement || !mapFallback || !markerLayer) return;

    stopSunTimer();
    mapStage?.classList.remove("is-globe-prepping", "is-globe-ready");
    globeElement.classList.add("is-fallback");
    mapFallback.hidden = false;
    markerLayer.replaceChildren(...entries.map(renderMarker));
    setGlobeStatus("Using the static where-ish fallback map.");
  };

  const renderMap = async (entries, activeEntry) => {
    if (!map) return;

    const normalizedEntries = entries.map(normalizeEntry);
    const normalizedActive = normalizedEntries.find((entry) => entry.id === activeEntry.id) || normalizeEntry(activeEntry);
    const mappableEntries = normalizedEntries
      .filter(hasCoordinates)
      .slice()
      .sort((a, b) => (b.lastIso || "").localeCompare(a.lastIso || ""));

    clearPinnedDetails();
    renderReadout(normalizedActive);
    if (streetRevealTimer) {
      window.clearTimeout(streetRevealTimer);
      streetRevealTimer = 0;
    }
    setStreetViewState(false);
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
      }
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

  const applyBrowserPosition = async (position, { revealDetails = false } = {}) => {
    const browserLocation = normalizeBrowserPosition(position);
    if (!browserLocation) throw new Error("missing browser coordinates");

    const returnToStreetView = streetViewActive;
    const meta = {
      ...(lastUnlockRecord.activeEntry.meta || {}),
      browserLocation,
    };
    const unlockRecord = recordUnlock(meta, { increment: false });
    lastUnlockRecord = unlockRecord;

    await renderMap(unlockRecord.entries, unlockRecord.activeEntry);
    if (returnToStreetView) {
      await enterStreetView(unlockRecord.activeEntry);
    } else if (revealDetails) {
      showMarkerDetails(normalizeEntry(unlockRecord.activeEntry), {
        pinned: true,
      });
    }
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
      await applyBrowserPosition(position, { revealDetails: !automatic });
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
    if (permissionState !== "granted") {
      setText(locationSource, permissionState === "denied" ? "browser precision blocked" : "approximate signal; precise location is opt in");
      setSharpenButtonText(permissionState === "denied" ? "retry precise location" : "use precise location");
      if (sharpenLocationButton) sharpenLocationButton.hidden = false;
      return;
    }

    await requestBrowserPrecision({ automatic: true });
  };

  const sharpenLocation = () => requestBrowserPrecision();

  const unlock = async () => {
    message.textContent = "access granted.";
    message.classList.remove("is-locked", "is-unlocked", "sr-only");
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
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const markerSelector = ".sirui-globe-marker, .sirui-map-marker-group, .sirui-celestial-marker";
    if (ignoreNextStageClickFromStreetMap || target.closest(".sirui-street-map-panel")) {
      ignoreNextStageClickFromStreetMap = false;
      if (ignoreStreetMapStageClickTimer) {
        window.clearTimeout(ignoreStreetMapStageClickTimer);
        ignoreStreetMapStageClickTimer = 0;
      }
      return;
    }

    if (streetViewActive && globeElement?.contains(target) && !target.closest(markerSelector)) {
      exitStreetView();
      return;
    }

    if (!target.closest(`${markerSelector}, .sirui-street-map-panel, .sirui-map-hud`)) {
      clearPinnedDetails();
    }
  });

  mapStage?.addEventListener(
    "wheel",
    () => {
      if (!map?.hidden) {
        clearStreetFocusTarget();
      }
    },
    { passive: true }
  );

  streetMapPanel?.addEventListener("pointerdown", suppressStageClickAfterStreetMapInteraction, {
    passive: true,
  });
  markerClose?.addEventListener("click", clearPinnedDetails);
  backToGlobeButton?.addEventListener("click", () => exitStreetView());
  streetDetailsToggle?.addEventListener("click", () => {
    setStreetSheetExpanded(!streetSheetExpanded);
  });
  sharpenLocationButton?.addEventListener("click", sharpenLocation);
  viewModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setViewMode(button.dataset.siruiView);
    });
  });
  timeModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setCelestialMode(button.dataset.siruiTimeMode);
      updateSunSystemOnce({ forceLayers: true });
    });
  });
  timeStepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      stepCelestialHours(Number(button.dataset.siruiTimeStep) || 0);
    });
  });
  window.addEventListener("resize", fitConsoleToViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", fitConsoleToViewport, {
    passive: true,
  });
  document.addEventListener("visibilitychange", updateGlobeAnimationState);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !map?.hidden) {
      if (streetViewActive) {
        exitStreetView();
        return;
      }
      clearPinnedDetails();
    }
  });

  setCelestialMode(celestialMode);

  const storedFruitPass = safeSessionGet(fruitPassKey);
  safeSessionRemove(oldPasswordKey);
  const validFruits = new Set(["mango", "orange", "strawberry", "banana"]);
  let fruitPass;

  try {
    fruitPass = storedFruitPass ? JSON.parse(storedFruitPass) : null;
  } catch {
    fruitPass = null;
  }

  const hasValidFruitPass = validFruits.has(fruitPass?.fruit) && Number.isFinite(Number(fruitPass?.unlockedAt)) && Number(fruitPass.unlockedAt) > 0;

  if (hasValidFruitPass) {
    unlock();
  } else {
    safeSessionRemove(fruitPassKey);
    message.classList.add("is-locked");
    message.innerHTML =
      '<span class="sirui-private-lock-kicker">private route</span><h1 class="sirui-private-lock-title">locked.</h1><p class="sirui-private-lock-copy">this page opens from the fruit checkpoint tucked into the blog title.</p><a class="sirui-private-lock-action" href="' +
      settings.blogUrl +
      '">return to the blog</a>';
  }
})();
