# FaceTrace — Cost-Free Cloudflare Live Demo Plan

This document is a **design + implementation plan** (not code yet) for hosting the FaceTrace
forensic-sketch app as a live, public, **$0/month** demo on Cloudflare — frontend **and** backend.

> Decision summary (from the user):
> - Deliverable: **plan document only** (no implementation in this pass).
> - Face matching: **real, client-side ONNX embeddings** + cosine similarity in the Worker.
> - Auth: **keep Firebase-only** (no public demo bypass).

---

## 1. What the project is today (verified by code walkthrough)

**Frontend** — React SPA (`src/`, `public/`), CRA-era but the `package.json` and
`public/manifest.json` are **missing** from the repo, so the frontend currently cannot be built.
- Routes: `/` (HomePage), `/attributes`, `/suspect-sketch`, `/pattern-matching`, `/profile`,
  `/login`, `/admin`, `/admin/users`.
- Auth-gated by `UserRoute.js` / `AdminRoute.js` against Firebase (hardcoded config in
  `src/firebaseConfig.js`: project `forensic-sketch`, Auth + Firestore + Storage).
- Every AI call hits a **hardcoded local Flask URL**:
  - `src/HomePage.js:255` → `http://localhost:5000/api/transcribe`
  - `src/HomePage.js:336` → `http://127.0.0.1:5000/api/llm-extract`
  - `src/HomePage.js:401` → `http://127.0.0.1:5000/api/generate-image`
  - `src/SuspectSketch.js:178` → `http://127.0.0.1:5000/api/refine-image`
  - `src/SuspectSketch.js:395` → `http://127.0.0.1:5000/api/verify`
  - `src/AttributeScreen.js:190` → `http://127.0.0.1:5000/api/inpaint`
  - `src/AdminHomeScreen.js:200` → `http://127.0.0.1:5000/api/enroll`

**Backend** — Python/Flask. The canonical server is `server/main.py` (ports 5000–5007 across
the variants). All heavy lifting is local ML:
- `faster-whisper` ASR (`/api/transcribe`)
- Ollama `mistral` LLM extraction (`/api/llm-extract`, `/api/refine-image` prompt evolution)
- Stable Diffusion / FLUX (`/api/generate-image`, `/api/refine-image`, `/api/inpaint`)
- DeepFace ArcFace + cosine similarity (`/api/verify`, `/api/enroll`)

**Gallery**: 9 real ArcFace 512-d embeddings already exist —
`face_recognition/embeddings/{arcface_embeddings,arcface_labels,arcface_image_urls}.npy`
(3 identities × 3 images: "Nithin CS", "Hari", "john doe"). Face photos live in Firebase
Storage (URLs inside the `.npy`).

---

## 2. Target architecture (everything on the free tier)

```
                         ┌──────────────────────────────────────────┐
   Browser (React SPA)   │  Cloudflare Pages (frontend)            │
      - Vite build       │    - static assets (dist/)              │
      - onnxruntime-web  │    - Pages Functions = the backend      │
        face embedding   │      (a Worker, served from /api/*)     │
                         └───────────────┬──────────────────────────┘
                                         │ Workers AI bindings (free tier)
                        ┌────────────────┼─────────────────────────┐
                        │                │                         │
                 whisper-large-v3-turbo  │                 stable-diffusion-v1-5-inpainting
                 llama-3.3-70b-fp8-fast  │                 flux-1-schnell
                                         ▼
                        ┌──────────────────────────────────────────┐
                        │  Worker code (JS/TS)                     │
                        │  - /api/transcribe, /api/llm-extract     │
                        │  - /api/generate-image, /api/refine-image│
                        │  - /api/inpaint, /api/verify             │
                        │  - bundled gallery.json (embeddings)     │
                        │  - pure-JS cosine similarity             │
                        └──────────────────────────────────────────┘
```

Key insight: **one Cloudflare Pages project hosts both** the static React app *and* the
backend via **Pages Functions** (`functions/` directory). Single repo, single deploy, both on
the free tier. No separate Worker needed.

### Why Pages Functions instead of a separate Worker
- Pages Functions are Cloudflare Workers under the hood → same runtime, same Workers AI bindings.
- Free tier: 100k requests/day, no cost.
- One `wrangler.toml` at repo root configures both the static build and the Functions.

---

## 3. Feature mapping (heavy Python → free Workers AI)

| Current route (Flask) | Today | Cloudflare replacement (model) | Cost class |
|---|---|---|---|
| `POST /api/transcribe` | faster-whisper `base` | `@cf/openai/whisper-large-v3-turbo` | ~0.05 neurons / audio-sec |
| `POST /api/llm-extract` | Ollama `mistral` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (JSON output) | ~27k neurons / M input tokens, ~205k / M output — small per call |
| `POST /api/generate-image` | SD local / HF API / FLUX | `@cf/black-forest-labs/flux-1-schnell` (4 steps, 1024×1024), loop `count` times | ~cheap per image |
| `POST /api/refine-image` | Ollama prompt evolution + text2image | llama-3.3-70b (prompt evolution) + flux-1-schnell (text2image) | same as above |
| `POST /api/inpaint` | SD inpainting local / HF API | `@cf/runwayml/stable-diffusion-v1-5-inpainting` (needs `image` + `mask_image`) | cheap per image |
| `POST /api/verify` | DeepFace ArcFace + cosine sim | **client-side ONNX embedding** + Worker JS cosine similarity vs `gallery.json` | **$0 (no model call)** |
| `POST /api/enroll` | DeepFace embeddings → `.npy` | **KV/R2-backed "embedding" store** (demo: recompute client-side, store in R2) | free tier |

### Response shapes the Worker MUST preserve (frontend depends on them)
- `transcribe` → `{ success, text, segments:[{text,start,end}] }`
- `llm-extract` → `{ success, features:{...}, rich_prompt }`
- `generate-image` → `{ success, images:[b64...], image:b64 }` (frontend maps to `data:image/png;base64,`)
- `refine-image` / `inpaint` → `{ success, image:b64, prompt, version? }`
- `verify` → `{ success, matches:[{label,similarity,verified,image_url}], best_match }`
- `enroll` → `{ success, embeddings_added, total_embeddings }`

The Worker must also handle **CORS preflight (OPTIONS)** and set
`Access-Control-Allow-Origin: *` — the frontend is served from a different origin than `/api/*`.

---

## 4. Free-tier budget (the math that makes it $0)

Cloudflare free allowances (all plans incl. Workers Free / Pages Free):

| Resource | Free allowance | Used by demo |
|---|---|---|
| Workers AI | **10,000 neurons / day** | all model calls |
| Pages | unlimited bandwidth, 500 builds/mo | static hosting |
| Pages Functions | 100,000 req/day | `/api/*` |
| R2 | 10 GB storage, 1M class-A ops/mo | (optional) gallery images copy |
| KV | 1 GB, 100k reads/day | (optional) enroll store |
| D1 | 5 GB | (optional) not needed for demo |
| Firebase (unchanged) | Spark plan, $0 | auth + Firestore + Storage |

**Rough per-demo-session spend:**
- 1× ASR (30 s audio) ≈ 1.5 neurons
- 1× LLM extract (~1–2 k tokens out) ≈ ~400 neurons
- 4× FLUX images (default `count:4`) ≈ a few thousand neurons — **the dominant cost**
- 1× inpaint ≈ modest
- 1× refine ≈ prompt evolution + 1 FLUX image

→ Expect roughly **10–40 full sessions/day** before hitting the cap. To stretch the budget:
- reduce frontend default `count` from 4 → 2–3 in demo mode;
- add a simple per-IP daily limiter (KV counter) that returns a friendly
  `{ success:false, error:"Demo limit reached, try again tomorrow" }`;
- lower FLUX to 512×512 and 4 steps.

> If the demo ever outgrows the cap: Workers Paid is $5/mo and *still includes* the same
> 10,000 free neurons/day — you only pay above that. Staying $0 is the default.

---

## 5. Frontend changes (repo: `src/`, `public/`)

1. **Recreate `package.json`** — recommend **Vite + React** over CRA (CRA is deprecated and
   unmaintained). Scripts: `dev`, `build` (`vite build`), `preview`. Dependencies the app
   actually uses:
   - `react`, `react-dom`, `react-router-dom`
   - `firebase` (auth + firestore + storage)
   - `html2canvas`, `jspdf` (export in `SuspectSketch.js`)
   - `onnxruntime-web` (new — client-side face embedding)
2. **Add `public/manifest.json`** (referenced by `public/index.html` but missing) and adjust
   `public/index.html` to Vite (drop `%PUBLIC_URL%`, use root-relative paths).
3. **Centralize the API base URL.** Create `src/config.js`:
   ```js
   export const API_BASE =
     import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
   ```
   Replace the 7 hardcoded `http://127.0.0.1:5000` / `localhost:5000` occurrences with
   `${API_BASE}/api/...`. Set `VITE_API_URL` to the live Pages domain during the build.
4. **Transcribe path (webm → wav).** `HomePage.js` records `audio/webm`. Workers AI whisper
   requires **16 kHz mono PCM WAV**. Add a tiny pure-JS step after recording:
   `AudioContext.decodeAudioData(blob)` → resample to 16 kHz mono → encode WAV
   (a ~50-line encoder, no dependency). Upload the `.wav` instead of the `.webm`.
5. **Matching module (real embeddings).** New `src/faceEmbedding.js`:
   - lazily loads `onnxruntime-web` (WASM) + a bundled face-embedding ONNX model from `public/`;
   - aligns/crops the sketch (small BlazeFace ONNX detector, or document that DeepFace-style
     alignment is skipped for sketches — see §6 caveats);
   - returns a 512-d (or 128-d) normalized embedding vector;
   - sends `{ embedding:[...] }` to `POST /api/verify`.
6. **No auth changes** — Firebase gates stay exactly as-is (per decision).

### Consistency requirement (important)
The gallery embeddings must come from the **same model** as the browser ONNX model. Either:
- (A) export the exact DeepFace/insightface ArcFace weights to ONNX and use that model in the
  browser; or
- (B) safer: re-run the gallery build with the exact browser-shipped model via a local Node/Python
  script, so both sides agree by construction.

Recommend **(B)** — details in §7.

---

## 6. Backend design (Pages Functions)

`functions/api/[route].js` or a single `functions/api/[[path]].js` dispatcher. Structure:

### `POST /api/transcribe`
- `await request.formData()` → get `file`; read as `ArrayBuffer`.
- Call `env.AI.run("@cf/openai/whisper-large-v3-turbo", { audio: [...int16], task:"transcribe" })`
  (convert bytes to Int16Array; audio must be 16 kHz PCM WAV per §5.4).
- Map response → `{ success, text, segments }` (segment timings from model output).

### `POST /api/llm-extract`
- System prompt = the forensic-attribute prompt currently in `server/main.py:266-295`
  (features dict + `rich_prompt`, "return only JSON").
- Use `llama-3.3-70b-instruct-fp8-fast` with `response_format:{type:"json_object"}` (supported).
- Robust-parse the response (reuse the regex `re.search(r"(\{.*\})")` idea in JS).
- Inject gender prefix into `rich_prompt` exactly like `server/main.py:330-333`.

### `POST /api/generate-image`
- Loop `count` times; each: `env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, negative_prompt, steps:4 })`.
- Response is binary image → base64 → append to `images[]`.
- Return `{ success, images, image:images[0] }`.

### `POST /api/refine-image`
- Step 1: llama-3.3-70b prompt evolution (same prompt as `server/main.py:436-444`).
- Step 2: flux-1-schnell text2image → base64.
- Return `{ success, image, prompt, version:"workers-ai-flux" }`.

### `POST /api/inpaint`
- Decode `image` + `mask` base64 (frontend already strips data URI).
- `env.AI.run("@cf/runwayml/stable-diffusion-v1-5-inpainting", { prompt: enrichedPrompt, image_b64: img, mask_image: mask })`.
  (Mask must be resized to match the image — do this in JS via canvas on the client or in the Worker;
  recommend client-side resize in `AttributeScreen.js`.)
- Return `{ success, image, prompt, version:"workers-ai-inpaint" }`.

### `POST /api/verify`
- Accept `{ embedding:[512 numbers] }` (computed in browser).
- Load bundled `gallery.json` (`[{ label, image_url, embedding }]`).
- Cosine similarity against all rows; take top-3; `verified = score >= 0.55`.
- Return `{ success, matches, best_match }`.

### `POST /api/enroll` (demo scope)
- ArcFace-style enrollment isn't possible server-side. Demo options:
  - compute the embedding **client-side** with the same ONNX module and POST it to
    `/api/enroll`, which appends to a small KV/R2-backed list (recompute gallery on the fly); or
  - keep enroll **out of the public demo** and note it as "admin/local-only".
- The existing 3-person gallery is pre-seeded, so `verify` works out of the box regardless.

### CORS + OPTIONS
- Add `Access-Control-Allow-Origin: *`, handle `OPTIONS` → `204`.

---

## 7. Embeddings: converting the existing gallery

Existing `.npy` files (real ArcFace 512-d, 3 identities):

| File | Content |
|---|---|
| `face_recognition/embeddings/arcface_embeddings.npy` | (9, 512) float32 |
| `face_recognition/embeddings/arcface_labels.npy` | ["Nithin CS","Nithin CS","Nithin CS","Hari","Hari","Hari","john doe","john doe","john doe"] |
| `face_recognition/embeddings/arcface_image_urls.npy` | 9 Firebase Storage URLs |

Plan:
1. Small conversion script (Python, `numpy` only — no DeepFace needed): read the three `.npy`,
   dedupe/group by label, round to 4 decimals, write `functions/gallery.json`:
   ```json
   [ { "label":"Nithin CS", "image_url":"...", "embedding":[ ...512 floats ] } ]
   ```
   (Keep 3 rows, one per identity; or all 9 rows — Worker similarity handles either.)
2. **Verify consistency** with the browser ONNX model (§5.6). If the client model's embedding
   space differs from DeepFace's ArcFace, regenerate gallery embeddings with the exact client
   model:
   - bundle the ONNX model + run it locally (Node `onnxruntime-node` or a Python onnxruntime
     session) on the 9 stored gallery images (download via the Firebase URLs) → `gallery.json`.
3. **Gallery images**: the Firebase Storage URLs may or may not be public. For the demo,
   either (a) confirm the bucket's read rules allow anonymous reads, or (b) copy the 9 photos to
   R2 and update `image_url` in `gallery.json` to R2 public URLs.

### The ONNX face model for the browser (choose one)
- **insightface MobileFaceNet** (~2–5 MB) — lightweight, fast on CPU/WASM, good enough for demo.
- **ArcFace R100** (resnet100, ~250 MB) — exact match to DeepFace's model space, but too heavy
  to ship to the browser. → only if paired with approach (B) and local-only embedding computation.
- Recommend **MobileFaceNet + approach (B)** as the practical free demo balance.

**Caveat (documented, not solved):** DeepFace's pipeline uses RetinaFace alignment before
embedding. Generated *sketches* are often not detected as faces. The demo ships a small
BlazeFace detector + a simple center-crop/resize fallback; match scores against the 3-person
gallery will be believable but lower-confidence. This is acceptable for a demo and is the
honest behaviour — `verified:false` results are expected and fine.

---

## 8. Step-by-step deployment (all free)

Prereqs: Node 18+, a Cloudflare account, the existing Firebase `forensic-sketch` project
running with email/password signup enabled.

```bash
# 0. tooling
npm install -g wrangler

# 1. frontend
npm install                 # after recreating package.json
npm run build               # -> dist/

# 2. backend
#    - add functions/ with the /api/* routes + gallery.json
#    - add wrangler.toml with an AI binding:
#      name = "forensic-sketch-demo"
#      compatibility_date = "2026-08-01"
#      [ai]
#      binding = "AI"

# 3. local check
npm run dev                 # frontend on :5173  (API_BASE -> local dev fallback)
wrangler pages dev dist     # Pages + Functions + AI binding locally

# 4. publish (one command)
wrangler pages deploy dist --project-name forensic-sketch-demo

# 5. build with the live API URL
#    VITE_API_URL=<your-pages-domain> npm run build
#    wrangler pages deploy dist --project-name forensic-sketch-demo

# 6. (optional) nicer domain: settings -> custom domain
```

Environment for the build: `VITE_API_URL` (set during `npm run build`). No secrets required —
Workers AI binding is configured in `wrangler.toml`, and the Firebase config is already
public-by-design.

---

## 9. Risks, limits & honest caveats

1. **10k neurons/day cap** → dominant cost is image generation (esp. `count:4`). Mitigate:
   lower default count, per-IP rate limiter via KV.
2. **Whisper format** → frontend must convert webm→16 kHz WAV (new small encoder) or
   transcription fails.
3. **Sketch matching is inherently lower-confidence** → expect plausible-but-weak matches;
   `verified:false` is normal. No real ArcFace-class accuracy server-side; the browser model is
   lightweight.
4. **Firebase dependency** → demo login requires the existing `forensic-sketch` project to
   still be active and its Firestore rules to allow `users` doc reads + signups. If not, the
   app is unusable without the demo-mode bypass (which the user declined).
5. **Hardcoded 5000-URLs** must be removed (all 7 sites) or the demo silently keeps calling
   localhost.
6. **Pages Functions CPU limits** → image generation/inpaint happen at the Workers AI edge, not
   in the Function, so CPU time is fine; only parsing/forwarding happens in the Function.
7. **`public/manifest.json` and `package.json` are missing** → must be recreated before any
   build works; this is the first required change.

---

## 10. Optional follow-ups (keep it $0)

- Per-IP daily quota via KV counters with friendly messaging.
- Demo analytics via Workers Analytics Engine (free).
- Custom domain + short "HOW IT WORKS" demo card on the landing page.
- Seed a 2nd, larger gallery (10–20 public-domain celebrity faces) to make `verify` demo more
  interesting — embeddings precomputed locally, stored in `gallery.json` (bundle size stays
  small: ~512 floats/row).
- Move enroll fully client-side (embedding computed in browser) so admins can add faces through
  the existing `AdminHomeScreen.js` UI, stored in KV/R2.

---

## 11. Suggested implementation order

1. Recreate `package.json` (Vite) + `public/manifest.json`; verify `npm run build` works.
2. Add `src/config.js` (`API_BASE`) and swap the 7 hardcoded URLs.
3. Add webm→WAV conversion in `HomePage.js`.
4. Build the `functions/api/*` Worker routes mirroring `server/main.py` responses + CORS.
5. Convert `.npy` → `gallery.json`; add client ONNX embedding module + `/api/verify`.
6. `wrangler pages dev` local test → `wrangler pages deploy` → set `VITE_API_URL` → ship.
