// src/imageUtils.js
// Builds a correctly-typed data URL from a raw base64 image payload.
// Workers AI image models return JPEG by default; the app previously assumed
// PNG everywhere, which broke rendering.
export function base64ToDataUrl(b64) {
  const s = String(b64 || "").trim();
  let mime = "image/png";
  try {
    const bin = atob(s.slice(0, 24));
    const b0 = bin.charCodeAt(0);
    if (b0 === 0xff) mime = "image/jpeg";
    else if (b0 === 0x89) mime = "image/png";
  } catch {
    // Not decodable base64 — fall back to PNG.
  }
  return `data:${mime};base64,${s}`;
}
