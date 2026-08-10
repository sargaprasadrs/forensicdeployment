// POST /api/enroll
// Intentionally not available in the public Cloudflare demo.
// Enrollment requires computing embeddings with the same model as the gallery;
// the demo ships with a fixed 3-person gallery (functions/api/gallery.js).
import { jsonError, configureCors } from "./_lib.js";
import { onRequestOptions } from "./_lib.js";

export { onRequestOptions };

export async function onRequest(context) {
  configureCors(context && context.env);
  return jsonError(
    "Enrollment is not available in this demo build. The gallery is fixed (3 identities).",
    501
  );
}
