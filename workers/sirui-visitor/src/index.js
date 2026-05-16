const LOG_TTL_SECONDS = 60 * 60 * 24 * 7;

const ALLOWED_ORIGINS = new Set([
  "https://dylantao.github.io",
  "http://localhost:4000",
  "http://127.0.0.1:4000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const jsonHeaders = (origin) => ({
  "Content-Type": "application/json; charset=utf-8",
  ...corsHeaders(origin),
});

const corsHeaders = (origin) => {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

const jsonResponse = (body, init = {}, origin = "") =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...jsonHeaders(origin),
      ...(init.headers || {}),
    },
  });

const clean = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const numberOrNull = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const countryNameFor = (countryCode) => {
  const code = clean(countryCode);
  if (!code) return "";

  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
};

const firstForwardedIp = (value) => clean(value).split(",")[0]?.trim() || "";

const getClientIp = (request) => clean(request.headers.get("CF-Connecting-IP")) || firstForwardedIp(request.headers.get("X-Forwarded-For"));

const buildVisit = (request) => {
  const cf = request.cf || {};
  const country = clean(cf.country);
  const now = new Date().toISOString();

  return {
    ip: getClientIp(request),
    city: clean(cf.city),
    region: clean(cf.region),
    regionCode: clean(cf.regionCode),
    country,
    countryName: countryNameFor(country),
    latitude: numberOrNull(cf.latitude),
    longitude: numberOrNull(cf.longitude),
    postalCode: clean(cf.postalCode),
    metroCode: clean(cf.metroCode),
    timezone: clean(cf.timezone),
    asn: numberOrNull(cf.asn),
    asOrganization: clean(cf.asOrganization),
    colo: clean(cf.colo),
    requestTime: now,
    cfRay: clean(request.headers.get("CF-Ray")),
  };
};

const buildPrivateLogRecord = (request, visit) => ({
  ...visit,
  acceptLanguage: clean(request.headers.get("Accept-Language")),
  referer: clean(request.headers.get("Referer")),
  userAgent: clean(request.headers.get("User-Agent")),
});

const writePrivateLog = (request, env, ctx, visit) => {
  if (!env?.VISIT_LOG?.put) return;

  const key = `visit:${Date.now()}:${crypto.randomUUID()}`;
  const record = buildPrivateLogRecord(request, visit);

  ctx.waitUntil(
    env.VISIT_LOG.put(key, JSON.stringify(record), {
      expirationTtl: LOG_TTL_SECONDS,
    }).catch((error) => {
      console.warn("visit log write failed", error);
    })
  );
};

export default {
  async fetch(request, env, ctx) {
    const origin = clean(request.headers.get("Origin"));
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (url.pathname === "/visit" && ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }

      return jsonResponse({ ok: false, error: "origin not allowed" }, { status: 403 }, origin);
    }

    if (request.method !== "GET" || url.pathname !== "/visit") {
      return jsonResponse({ ok: false, error: "not found" }, { status: 404 }, origin);
    }

    const visit = buildVisit(request);
    writePrivateLog(request, env, ctx, visit);

    return jsonResponse(
      {
        ok: true,
        retentionSeconds: LOG_TTL_SECONDS,
        visit,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
      origin
    );
  },
};
