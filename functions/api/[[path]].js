// Catch-all fallback for /api/* routes that are not implemented yet.
// Lets the frontend receive a clean JSON error instead of an HTML 404.
import { jsonError, configureCors } from "./_lib.js";
import { onRequestOptions } from "./_lib.js";

export { onRequestOptions };

export async function onRequest(context) {
  configureCors(context && context.env);
  const url = new URL(context.request.url);
  return jsonError(`Route not implemented: ${url.pathname}`, 404);
}
