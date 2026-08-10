// POST /api/generate-image
// Generates forensic face images from a text prompt using Workers AI FLUX.
// Mirrors the response shape of server/main.py:
//   { success, images: [base64...], image: base64 }
// Note: on Workers AI every mode (pencil_sketch / realistic_photo / gan_hq)
// uses the same FLUX.1-schnell model; mode only affects the prompt wording,
// which the frontend already composes.
import { json, jsonError, arrayBufferToBase64, configureCors, checkDailyQuota } from "./_lib.js";
import { onRequestOptions } from "./_lib.js";

export { onRequestOptions };

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
// Free-tier budget protection: a single request must not spend the day's
// ~10k neuron allowance (one 1024x1024 image is the dominant cost).
const MAX_COUNT = 1;
const MAX_PROMPT_LEN = 2000;
const MAX_NEGATIVE_LEN = 1000;
const STEPS = 4;

// Workers AI image models can return the image bytes in different shapes
// depending on the binding version: a bare ArrayBuffer, a Uint8Array, an
// object like { image: ArrayBuffer | Uint8Array | base64 }, or a stream.
async function resultToArrayBuffer(result) {
  if (result instanceof ArrayBuffer) return result;
  if (result instanceof ReadableStream) return new Response(result).arrayBuffer();
  if (ArrayBuffer.isView(result)) {
    return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
  }
  if (result && typeof result === "object") {
    const img = result.image;
    if (img instanceof ArrayBuffer) return img;
    if (img instanceof ReadableStream) return new Response(img).arrayBuffer();
    if (ArrayBuffer.isView(img)) {
      return img.buffer.slice(img.byteOffset, img.byteOffset + img.byteLength);
    }
    if (typeof img === "string") {
      const bin = atob(img.replace(/^data:[^;]+;base64,/, ""));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    }
  }
  throw new Error("Image generation returned an unexpected response");
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

  const prompt = (data.prompt || "").toString().trim();
  if (!prompt) return jsonError("Empty prompt", 400);
  if (prompt.length > MAX_PROMPT_LEN) {
    return jsonError(`Prompt too long (max ${MAX_PROMPT_LEN} characters)`, 400);
  }
  const negativePrompt = (data.negative_prompt || "").toString().slice(0, MAX_NEGATIVE_LEN);

  if (!env.AI) {
    return jsonError("Workers AI binding (AI) is not configured on this deployment", 500);
  }

  // Per-IP daily quota (after validation so bad requests don't burn it).
  const blocked = await checkDailyQuota(env, request);
  if (blocked) return blocked;

  const count = Math.min(Math.max(parseInt(data.count, 10) || 1, 1), MAX_COUNT);

  const images = [];
  for (let i = 0; i < count; i++) {
    try {
      const input = { prompt, steps: STEPS, height: 1024, width: 1024 };
      if (negativePrompt) input.negative_prompt = negativePrompt;
      const result = await env.AI.run(MODEL, input);
      const buffer = await resultToArrayBuffer(result);
      images.push(arrayBufferToBase64(buffer));
    } catch (e) {
      console.error("generate-image error:", e);
      return jsonError("Image generation failed. Please try again.", 500);
    }
  }

  return json({ success: true, images, image: images[0] || null });
}
