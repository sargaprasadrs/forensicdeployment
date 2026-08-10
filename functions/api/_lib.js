// Shared helpers for Cloudflare Pages Functions (the FaceTrace backend).

// CORS origin, restricted via env.ALLOWED_ORIGIN when set (default: "*").
let _allowedOrigin = "*";

export function configureCors(env) {
  if (env && typeof env.ALLOWED_ORIGIN === "string" && env.ALLOWED_ORIGIN.trim()) {
    _allowedOrigin = env.ALLOWED_ORIGIN.trim();
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": _allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export function jsonError(message, status = 500) {
  return json({ success: false, error: message }, status);
}

// Handles the CORS preflight for a given route.
export function onRequestOptions(context) {
  configureCors(context && context.env);
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// Per-IP daily quota for the paid AI endpoints (Workers AI free tier is
// ~10k neurons/day). Uses a KV namespace bound as AI_LIMIT_KV. The limit is
// configurable via env.AI_DAILY_LIMIT (default 10). Returns null when the
// request may proceed, otherwise a 429 Response.
const DEFAULT_DAILY_LIMIT = 10;

export async function checkDailyQuota(env, request) {
  if (!env || !env.AI_LIMIT_KV) return null; // KV not bound -> don't block
  const ip = (request.headers.get("CF-Connecting-IP") || "unknown").slice(0, 64);
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `demo:${ip}:${day}`;
  const limit = parseInt(env.AI_DAILY_LIMIT, 10) || DEFAULT_DAILY_LIMIT;
  try {
    const current = parseInt((await env.AI_LIMIT_KV.get(key)) || "0", 10) || 0;
    if (current >= limit) {
      return json(
        { success: false, error: "Demo limit reached, please try again tomorrow" },
        429
      );
    }
    await env.AI_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 86400 });
  } catch (e) {
    // A KV failure must never take the demo down; log and continue.
    console.error("Quota check failed:", e);
  }
  return null;
}

// Convert an ArrayBuffer (e.g. a Workers AI image response) to a base64 string.
// Chunked to avoid call-stack overflow on multi-MB images.
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
