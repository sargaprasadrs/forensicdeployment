// POST /api/match-face
// Text-based face matching using Workers AI text embeddings.
// Takes the rich_prompt from LLM extraction, creates an embedding, and
// compares against the gallery descriptions using cosine similarity.
//   { success, matches: [{ label, similarity, image_url }], best_match }
import { json, jsonError, configureCors, checkDailyQuota } from "./_lib.js";
import { onRequestOptions } from "./_lib.js";
import gallery from "./gallery.js";

export { onRequestOptions };

const MAX_MATCHES = 3;
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

// Cosine similarity between two vectors.
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Normalize a vector to unit length.
function normalize(v) {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  configureCors(env);

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const description = (data.description || "").toString().trim();
  if (!description) {
    return jsonError("Missing description", 400);
  }
  if (description.length > 2000) {
    return jsonError("Description too long", 400);
  }

  if (!env.AI) {
    return jsonError("Workers AI binding (AI) is not configured on this deployment", 500);
  }

  // Per-IP daily quota (after validation).
  const blocked = await checkDailyQuota(env, request);
  if (blocked) return blocked;

  try {
    // Embed the query description.
    const queryResult = await env.AI.run(EMBEDDING_MODEL, {
      text: [description],
    });
    const queryEmbedding = normalize(queryResult.data[0]);

    // Embed each gallery description and compute similarity.
    const scored = [];
    for (const person of gallery) {
      const personResult = await env.AI.run(EMBEDDING_MODEL, {
        text: [person.description],
      });
      const personEmbedding = normalize(personResult.data[0]);
      const similarity = cosine(queryEmbedding, personEmbedding);
      scored.push({
        label: person.label,
        similarity: Math.round(similarity * 1000) / 1000, // round to 3 decimals
        image_url: person.image_url || "",
      });
    }

    // Sort by similarity descending.
    scored.sort((a, b) => b.similarity - a.similarity);
    const matches = scored.slice(0, MAX_MATCHES);
    const best = matches[0] || null;

    return json({
      success: true,
      matches,
      best_match: best,
    });
  } catch (e) {
    console.error("match-face error:", e);
    return jsonError("Face matching failed. Please try again.");
  }
}