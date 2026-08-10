// Centralized backend API configuration.
// Defaults to the same origin: the Pages Functions that ship with this repo are
// served from /api/* on the same domain as the static frontend, so no absolute
// URL is needed in production (or with `wrangler pages dev`).
// For local-only Flask development, override during the build:
//   VITE_API_URL=http://127.0.0.1:5000 npm run dev
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";
