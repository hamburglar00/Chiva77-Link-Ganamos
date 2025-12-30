// /api/get-random-phone-normal.js
// ✅ Devuelve 1 número LISTO para wa.me (NORMAL)
// ✅ Plan A/B/C/D como API 1
// ✅ Solo usa data.whatsapp (NO ADS)

const CONFIG = {
  AGENCY_ID: 17,
  BRAND_NAME: "Geraldina",

  // Soporte (Plan D)
  SUPPORT_FALLBACK_ENABLED: true,
  SUPPORT_FALLBACK_NUMBER: "5491169789243",

  // Robustez
  TIMEOUT_MS: 2500,
  MAX_RETRIES: 2,

  UPSTREAM_BASE: "https://api.asesadmin.com/api/v1",
};

let LAST_GOOD_NUMBER = null;
let LAST_GOOD_META = null;

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

function normalizePhone(raw) {
  let phone = String(raw || "").replace(/\D+/g, "");
  if (phone.length === 10) phone = "54" + phone; // AR
  if (!phone || phone.length < 8) return null;
  return phone;
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "Cache-Control": "no-store" },
      signal: ctrl.signal,
    });
    const ms = Date.now() - started;

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.http_status = res.status;
      err.ms = ms;
      throw err;
    }

    const json = await res.json();
    return { json, ms, status: res.status };
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  const startedAt = Date.now();

  // Cache-control fuerte
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");

  const mode = String(req.query.mode || "normal").toLowerCase();

  try {
    const API_URL = `${CONFIG.UPSTREAM_BASE}/agency/${CONFIG.AGENCY_ID}/random-contact`;

    // ============================================================
    // ✅ Plan A: upstream con timeout + retries
    // ============================================================
    let data = null;
    let upstreamMeta = { attempts: 0, last_error: null, ms: null, status: null };

    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES && !data; attempt++) {
      upstreamMeta.attempts = attempt;
      try {
        const r = await fetchJsonWithTimeout(API_URL, CONFIG.TIMEOUT_MS);
        data = r.json;
        upstreamMeta.ms = r.ms;
        upstreamMeta.status = r.status;
      } catch (e) {
        upstreamMeta.last_error = e?.message || "unknown";
        upstreamMeta.status = e?.http_status || null;
      }
    }

    if (!data) {
      throw new Error(`Upstream fail: ${upstreamMeta.last_error || "unknown"}`);
    }

    // ============================================================
    // ✅ Plan B: SOLO NORMAL => data.whatsapp
    // ============================================================
    const normalList = Array.isArray(data?.whatsapp) ? data.whatsapp : [];

    if (!normalList.length) {
      throw new Error("whatsapp (normal) vacío");
    }

    const rawPhone = pickRandom(normalList);
    const phone = normalizePhone(rawPhone);

    if (!phone) throw new Error("Número inválido desde whatsapp (normal)");

    // ============================================================
    // ✅ Plan C (server): guardar “último bueno”
    // ============================================================
    LAST_GOOD_NUMBER = phone;
    LAST_GOOD_META = {
      agency_id: CONFIG.AGENCY_ID,
      source: "whatsapp",
      ts: new Date().toISOString(),
      upstream: upstreamMeta,
      normal_len: normalList.length,
    };

    // ✅ Respuesta “compatible” con tu HTML NUEVO (number + name)
    return res.status(200).json({
      number: phone,
      name: CONFIG.BRAND_NAME,
      weight: 1,
      mode,
      chosen_from: "whatsapp",
      ms: Date.now() - startedAt,
      upstream: upstreamMeta,
    });
  } catch (err) {
    // ============================================================
    // ✅ Plan C (respuesta): devolver “último bueno” si existe
    // ============================================================
    if (LAST_GOOD_NUMBER && String(LAST_GOOD_NUMBER).length >= 8) {
      return res.status(200).json({
        number: LAST_GOOD_NUMBER,
        name: "LastGoodCache",
        weight: 1,
        mode,
        cache: true,
        last_good_meta: LAST_GOOD_META || null,
        error: err?.message || "unknown_error",
        ms: Date.now() - startedAt,
      });
    }

    // ============================================================
    // ✅ Plan D: soporte
    // ============================================================
    if (CONFIG.SUPPORT_FALLBACK_ENABLED) {
      return res.status(200).json({
        number: CONFIG.SUPPORT_FALLBACK_NUMBER,
        name: "SupportFallback",
        weight: 1,
        mode,
        fallback: true,
        error: err?.message || "unknown_error",
        ms: Date.now() - startedAt,
      });
    }

    // Si querés que el frontend decida en vez de soporte:
    return res.status(503).json({
      error: "NO_NUMBER_AVAILABLE",
      mode,
      details: err?.message || "unknown_error",
      ms: Date.now() - startedAt,
    });
  }
}
