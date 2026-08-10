// POST /api/transcribe
// Transcribes a witness recording (multipart "file") using Workers AI Whisper.
// Mirrors server/main.py: { success, text, segments: [{ text, start, end }] }
// The client sends a 16 kHz mono 16-bit PCM WAV (src/audioUtils.js); the WAV
// "data" chunk is passed to Whisper as int16 samples.
import { json, jsonError, configureCors, checkDailyQuota } from "./_lib.js";
import { onRequestOptions } from "./_lib.js";

export { onRequestOptions };

const MODEL = "@cf/openai/whisper-large-v3-turbo";
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

// Extracts the integer PCM samples from a 16-bit PCM WAV byte buffer.
function wavToInt16(buf) {
  if (buf.byteLength < 12) throw new Error("audio too small");
  const bytes = new Uint8Array(buf);
  const ascii = (start, len) =>
    String.fromCharCode(...bytes.subarray(start, start + len));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE") {
    throw new Error("not a WAV file");
  }
  let offset = 12;
  while (offset + 8 <= buf.byteLength) {
    const id = ascii(offset, 4);
    const size =
      bytes[offset + 4] |
      (bytes[offset + 5] << 8) |
      (bytes[offset + 6] << 16) |
      (bytes[offset + 7] << 24);
    if (id === "data") {
      return new Int16Array(buf.slice(offset + 8, offset + 8 + size));
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("no data chunk in WAV");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  configureCors(env);

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected multipart form data", 400);
  }
  const file = form.get("file");
  if (!file) return jsonError("No audio file provided", 400);
  if (file.size > MAX_FILE_BYTES) {
    return jsonError("Audio file too large (max 15 MB)", 413);
  }

  if (!env.AI) {
    return jsonError("Workers AI binding (AI) is not configured on this deployment", 500);
  }

  // Per-IP daily quota (after validation so bad requests don't burn it).
  const blocked = await checkDailyQuota(env, request);
  if (blocked) return blocked;

  let samples;
  try {
    const buf = await file.arrayBuffer();
    samples = wavToInt16(buf);
  } catch (e) {
    return jsonError("Could not decode audio (expected 16-bit PCM WAV)", 400);
  }

  try {
    const out = await env.AI.run(MODEL, {
      audio: Array.from(samples),
      task: "transcribe",
    });
    const text = (out?.text || "").toString().trim();
    return json({
      success: true,
      text,
      segments: Array.isArray(out?.segments)
        ? out.segments.map((s) => ({
            text: s.text || "",
            start: typeof s.start === "number" ? s.start : 0,
            end: typeof s.end === "number" ? s.end : 0,
          }))
        : [],
    });
  } catch (e) {
    console.error("transcribe error:", e);
    return jsonError("Transcription failed. Please try again.");
  }
}
