// POST /api/verify
// Cosine-similarity matching against the bundled gallery.
// The query embedding is computed in the browser (src/faceEmbedding.js) with a
// client-side ONNX model and sent here.
//   { success, matches: [{ label, similarity, verified, image_url }], best_match }
import { json, jsonError, configureCors } from "./_lib.js";
import { onRequestOptions } from "./_lib.js";
import gallery from "./gallery.js";

export { onRequestOptions };

const MAX_MATCHES = 3;

export async function onRequestPost(context) {
  const { request, env } = context;
  configureCors(env);

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const embedding = data.embedding;
  if (!Array.isArray(embedding) || embedding.length < 64) {
    return jsonError("Missing or invalid embedding (expected array of floats)", 400);
  }

  const threshold = typeof data.threshold === "number" ? data.threshold : 0.55;

  const query = normalize(embedding);
  const scored = gallery
    .map((row) => {
      const similarity = cosine(query, row.embedding);
      return {
        label: row.label,
        similarity,
        verified: similarity >= threshold,
        image_url: row.image_url || "",
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  const matches = scored.slice(0, MAX_MATCHES);
  const best = matches[0] || null;
  // Top-level fields mirror server/main.py's single-match response so the
  // existing frontend (logging + navigation) keeps working unchanged.
  return json({
    success: true,
    matches,
    best_match: best,
    similarity: best ? best.similarity : 0,
    label: best ? best.label : null,
    verified: best ? best.verified : false,
    image_url: best ? best.image_url : "",
  });
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function normalize(v) {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}
