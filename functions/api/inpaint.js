// POST /api/inpaint
// Mask-based inpainting on the generated sketch with Workers AI
// (Stable Diffusion v1.5 inpainting). Mirrors server/main.py:
//   { success, image, prompt, version }
import { json, jsonError, arrayBufferToBase64, configureCors, checkDailyQuota } from "./_lib.js";
import { onRequestOptions } from "./_lib.js";

export { onRequestOptions };

const MODEL = "@cf/runwayml/stable-diffusion-v1-5-inpainting";
const MAX_PROMPT_LEN = 1000;
// ~10 MB binary per side (base64 is ~33% larger).
const MAX_B64_LEN = 13_000_000;

function decodeBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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
  if (!data.image || !data.mask) return jsonError("Missing image or mask", 400);
  if (data.image.length > MAX_B64_LEN || data.mask.length > MAX_B64_LEN) {
    return jsonError("Image or mask too large (max ~10 MB)", 413);
  }

  if (!env.AI) {
    return jsonError("Workers AI binding (AI) is not configured on this deployment", 500);
  }

  // Per-IP daily quota (after validation so bad requests don't burn it).
  const blocked = await checkDailyQuota(env, request);
  if (blocked) return blocked;

  try {
    const imageBytes = decodeBase64(data.image);
    const maskBytes = decodeBase64(data.mask);

    const result = await env.AI.run(MODEL, {
      prompt,
      image: imageBytes,
      mask: maskBytes,
      strength: 0.75,
      guidance_scale: 7.5,
      num_steps: 30,
    });

    return json({
      success: true,
      image: arrayBufferToBase64(result),
      prompt,
      version: "workers-ai-inpaint",
    });
  } catch (e) {
    console.error("inpaint error:", e);
    return jsonError("Inpainting failed. Please try again.");
  }
}
