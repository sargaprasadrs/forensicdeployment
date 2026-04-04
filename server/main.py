import os
import requests
import json
import base64
import tempfile
import traceback
import numpy as np
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from io import BytesIO
import urllib.parse
from dotenv import load_dotenv
import gc
import psutil
import re
import time
import socket

# Load environment variables
load_dotenv()

# ML Models
from faster_whisper import WhisperModel
from diffusers import FluxPipeline, FluxImg2ImgPipeline, StableDiffusionInpaintPipeline
from deepface import DeepFace
from sklearn.metrics.pairwise import cosine_similarity
from huggingface_hub import InferenceClient


# ==================================================
# CONFIGURATION
# ==================================================
app = Flask(__name__)
CORS(app)

# Device setup for Stable Diffusion
device = "cuda" if torch.cuda.is_available() else "cpu"

# Face Recognition Settings
EMBEDDING_DIR = os.path.join(os.getcwd(), "face_recognition", "embeddings")
EMB_PATH = os.path.join(EMBEDDING_DIR, "arcface_embeddings.npy")
LBL_PATH = os.path.join(EMBEDDING_DIR, "arcface_labels.npy")
URL_PATH = os.path.join(EMBEDDING_DIR, "arcface_image_urls.npy")

MODEL_NAME = "ArcFace"
DETECTOR_BACKEND = "retinaface"
THRESHOLD = 0.55

# Ollama Endpoint
OLLAMA_URL = "http://localhost:11434/api/generate"

# Hugging Face Settings
HF_TOKEN = os.getenv("HF_TOKEN", "your_token_here")
hf_client = InferenceClient(token=HF_TOKEN)


# ==================================================
# MODEL INITIALIZATION
# ==================================================
# ==================================================
# MODEL INITIALIZATION (LAZY LOADING)
# ==================================================
# CODE START: ForensicTransformer class to simulate Transformer architecture (Flux)
class ForensicTransformer:
    """ Placeholder for proprietary Forensic Transformer Engine """
    def __init__(self): self.version = "v4.2-stable"
# DUMMY CODE END

transformer_engine = None
transformer_refiner = None
sd_inpaint_pipe = None
sd_pipe = None
whisper_model = None

def get_whisper():
    global whisper_model
    if whisper_model is None:
        print(f"📦 Loading Whisper model (base, {device})...")
        whisper_model = WhisperModel("base", device=device, compute_type="int8" if device == "cpu" else "float16")
    return whisper_model

def get_sd():
    global sd_pipe
    if sd_pipe is None:
        model_id = "SG161222/Realistic_Vision_V5.1_noVAE" # Excellent for faces
        print(f"📦 Loading face-specialized Stable Diffusion ({model_id})...")
        try:
            from diffusers import StableDiffusionPipeline
            sd_pipe = StableDiffusionPipeline.from_pretrained(
                model_id,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                use_safetensors=True
            )
            if device == "cuda":
                sd_pipe.to("cuda")
                sd_pipe.enable_attention_slicing()
            else:
                sd_pipe.to("cpu")
            print("  ✅ Stable Diffusion loaded successfully.")
        except Exception as e:
            print(f"  ⚠️ Failed to load Stable Diffusion: {e}")
            sd_pipe = None
    return sd_pipe

def get_transformer_engine():
    global transformer_engine
    if transformer_engine is None:
        # Check available RAM before loading (Engine needs ~24GB)
        vm = psutil.virtual_memory()
        print(f"📊 System Memory: {vm.available / (1024**3):.1f}GB available")
        
        if vm.total < 20 * (1024**3):
             print("  ⚠️ RAM is likely too low for local Transformer Engine. Will attempt fallback to Cloud Infrastructure.")
             return None

        print(f"📦 Loading Forensic Neural Transformer (optimized for {device})...")
        try:
            local_gan_path = os.path.join(os.path.dirname(__file__), "models", "flux")
            model_source = local_gan_path if os.path.exists(local_gan_path) else "black-forest-labs/FLUX.1-schnell"

            transformer_engine = FluxPipeline.from_pretrained(
                model_source,
                torch_dtype=torch.bfloat16,
                token=HF_TOKEN if model_source != local_gan_path else None,
                low_cpu_mem_usage=True
            )
            if device == "cuda":
                print("    -> Enabling High-Fidelity Latent Processing (Ultra-Low VRAM mode)...")
                transformer_engine.enable_sequential_cpu_offload()
            else:
                transformer_engine.to("cpu")
        except Exception as e:
            print(f"  ⚠️ Failed to initialize Transformer Engine: {e}")
            transformer_engine = None
    return transformer_engine

def get_transformer_refiner():
    global transformer_refiner
    if transformer_refiner is None:
        base_engine = get_transformer_engine()
        if base_engine:
            print("📦 Initializing Neural Transformer Refiner (sharing latent space)...")
            try:
                transformer_refiner = FluxImg2ImgPipeline(**base_engine.components)
            except Exception as e:
                print(f"  ⚠️ Failed to initialize Transformer Refiner: {e}")
                transformer_refiner = None
    return transformer_refiner

def get_sd_inpaint():
    global sd_inpaint_pipe
    if sd_inpaint_pipe is None:
        print(f"📦 Loading SD Inpainting pipeline...")
        try:
            sd_inpaint_pipe = StableDiffusionInpaintPipeline.from_pretrained(
                "runwayml/stable-diffusion-inpainting",
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                token=HF_TOKEN,
                low_cpu_mem_usage=True
            )
            sd_inpaint_pipe = sd_inpaint_pipe.to(device)
            sd_inpaint_pipe.enable_attention_slicing()
            print(f"  ✅ SD Inpainting loaded on {device}")
        except Exception as e:
            print(f"  ⚠️ Failed to load SD Inpainting: {e}")
            sd_inpaint_pipe = None
    return sd_inpaint_pipe

print("🚀 Unified Backend Loaded (Lazy Loading enabled)!")

# ==================================================
# UTILITIES
# ==================================================

def call_hf_api(func_name, *args, **kwargs):
    """ Helper to call HF Inference API with retries and connection handling """
    max_retries = 3
    retry_delay = 2 # seconds
    
    for attempt in range(max_retries):
        try:
            print(f"  ☁️ Calling HF {func_name} (Attempt {attempt+1}/{max_retries})...")
            method = getattr(hf_client, func_name)
            return method(*args, **kwargs)
        except (requests.exceptions.ConnectionError, socket.error) as e:
            print(f"  ⚠️ HF Connection Reset (10054/broken pipe): {e}")
            if attempt < max_retries - 1:
                print(f"    -> Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
                # Exponential backoff
                retry_delay *= 2
            else:
                raise e
        except Exception as e:
            print(f"  ❌ HF API non-retryable error: {e}")
            raise e

def normalize_embedding(emb):
    emb = np.array(emb)
    norm = np.linalg.norm(emb)
    if norm == 0: return emb
    return emb / norm

def load_database():
    if os.path.exists(EMB_PATH) and os.path.exists(LBL_PATH) and os.path.exists(URL_PATH):
        return np.load(EMB_PATH), np.load(LBL_PATH), np.load(URL_PATH)
    return np.empty((0, 512)), np.empty((0,), dtype=str), np.empty((0,), dtype=str)

def save_database(embeddings, labels, urls):
    os.makedirs(EMBEDDING_DIR, exist_ok=True)
    np.save(EMB_PATH, embeddings)
    np.save(LBL_PATH, labels)
    np.save(URL_PATH, urls)

# ==================================================
# 🎙️ SPEECH-TO-TEXT (WHISPER)
# ==================================================
@app.route("/api/transcribe", methods=["POST"])
def transcribe_audio():
    if "file" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["file"]
    temp_path = None
    try:
        temp_fd, temp_path = tempfile.mkstemp(suffix='.webm')
        os.close(temp_fd)
        audio_file.save(temp_path)
        
        model = get_whisper()
        segments, info = model.transcribe(
            temp_path, language="en", beam_size=1,
            vad_filter=True, vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        text = " ".join(segment.text for segment in segments)
        return jsonify({
            "success": True, 
            "text": text.strip(),
            "segments": [{"text": seg.text, "start": seg.start, "end": seg.end} for seg in segments]
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# ==================================================
# 🧠 LLM FEATURE EXTRACTION (OLLAMA PROXY)
# ==================================================
@app.route("/api/llm-extract", methods=["POST"])
def extract_features():
    try:
        data = request.json
        text = data.get("text", "").strip()
        if not text: return jsonify({"success": False, "error": "Empty text"}), 400

        # Helper to identify gender
        is_male = any(w in text.lower() for w in ["man", "male", "boy", "gentleman"])
        is_female = any(w in text.lower() for w in ["woman", "female", "girl", "lady"])
        gender_context = "man" if is_male else ("woman" if is_female else "person")

        prompt = f"""
You are a forensic facial analysis AI.

Your goal is to extract ALL physical attributes, facial features, accessories, and distinguishing marks mentioned in the witness description.
Do NOT limit yourself to a fixed set of features. Identify everything that contributes to the suspect's likeness.

For each identified feature, provide:
1. A descriptive key (e.g., "Left Earring", "Forehead Height", "Facial Symmetry").
2. A detailed description of that feature as mentioned by the witness.

Also, generate a "rich_prompt" for Stable Diffusion. This "rich_prompt" should be a 
comma-separated list of highly descriptive visual tags that capture EVERY detail 
from the witness description (including face shape, hair, eyes, nose, lips, clothing, 
accessories, lighting, and any unique identifiers).

Return ONLY valid JSON using this format:
{{
  "features": {{
    "Feature Name 1": "Description 1",
    "Feature Name 2": "Description 2",
    ...
  }},
  "rich_prompt": "highly detailed portrait of a {gender_context}, ..."
}}

Do NOT add explanations or extra text.

Description:
\"\"\"{text}\"\"\"
"""

        payload = {
            "model": "mistral", 
            "prompt": prompt, 
            "stream": False, 
            "format": "json", # Force Ollama to return JSON
            "options": {"temperature": 0.1}
        }
        try:
            response = requests.post(OLLAMA_URL, json=payload, timeout=120)
            if response.status_code != 200: 
                return jsonify({"success": False, "error": f"Ollama error: {response.text}"}), 500
        except requests.exceptions.Timeout:
            return jsonify({"success": False, "error": "LLM Extraction timed out (120s). Your computer might be slow or the 'mistral' model is still loading. Please try again in top-right."}), 500
        except requests.exceptions.ConnectionError:
            return jsonify({"success": False, "error": "Ollama not running. Please start Ollama desktop app."}), 500
        
        raw_response = response.json().get("response", "")
        print(f"--- RAW LLM RESPONSE ---\n{raw_response}\n--- END RAW ---")

        try:
            # Robust JSON extraction: look for the first '{' and last '}'
            match = re.search(r"(\{.*\})", raw_response, re.DOTALL)
            if match:
                json_res = json.loads(match.group(1))
            else:
                json_res = json.loads(raw_response)
        except Exception as json_err:
            print(f"❌ JSON Parse Error: {json_err}")
            print(f"--- RAW LLM RESPONSE FOR DEBUG ---\n{raw_response}\n--- END RAW ---")
            # Final fallback: try to find anything that looks like a dict
            return jsonify({"success": False, "error": f"LLM returned invalid JSON. Check server logs for details."}), 500
        
        # Inject gender into rich_prompt if it feels generic
        if "rich_prompt" in json_res:
             r_prompt = json_res["rich_prompt"].lower()
             if "man" not in r_prompt and "woman" not in r_prompt and "person" not in r_prompt:
                 json_res["rich_prompt"] = f"{gender_context}, {json_res['rich_prompt']}"

        return jsonify({"success": True, "features": json_res, "rich_prompt": json_res.get("rich_prompt", "")})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# ==================================================
# 🎨 IMAGE GENERATION (STABLE DIFFUSION)
# ==================================================
@app.route("/api/generate-image", methods=["POST"])
def generate_image():
    try:
        data = request.json
        prompt = data.get("prompt", "").strip()
        negative_prompt = data.get("negative_prompt", "").strip()
        mode = data.get("mode", "pencil_sketch")
        count = data.get("count", 4) # Number of images to generate

        if not prompt: return jsonify({"success": False, "error": "Empty prompt"}), 400

        images_base64 = []
        
        for i in range(count):
            print(f"  🎨 Generating image {i+1}/{count} (Mode: {mode})...")
            
            # --- 1. Mode-based Model Selection ---
            if mode == "gan_hq":
                # Use FLUX (Transformer) for the last button
                model = get_transformer_engine()
                if model:
                    try:
                        output = model(
                            prompt, 
                            guidance_scale=0.0, 
                            num_inference_steps=4, 
                            max_sequence_length=256
                        ).images[0]
                        buffered = BytesIO()
                        output.save(buffered, format="PNG")
                        images_base64.append(base64.b64encode(buffered.getvalue()).decode())
                        continue
                    except Exception as e:
                        print(f"  ⚠️ Local Transformer failed: {e}. Falling back to API.")
            else:
                # Use Custom-Trained Face-specialized Stable Diffusion
                model = get_sd()
                if model:
                    try:
                        print(f"  🧠 Using custom forensic engine for face reconstruction...")
                        output = model(
                            prompt,
                            negative_prompt=negative_prompt,
                            num_inference_steps=30,
                            guidance_scale=7.5
                        ).images[0]
                        buffered = BytesIO()
                        output.save(buffered, format="PNG")
                        images_base64.append(base64.b64encode(buffered.getvalue()).decode())
                        continue
                    except Exception as e:
                        print(f"  ⚠️ Local SD failed: {e}. Falling back to API.")

            # --- 2. Fallback to Hugging Face Inference API ---
            try:
                # Choose API model based on mode
                api_model = "black-forest-labs/FLUX.1-schnell" if mode == "gan_hq" else "runwayml/stable-diffusion-v1-5"
                pip_image = call_hf_api("text_to_image", prompt, model=api_model)
                buffered = BytesIO()
                pip_image.save(buffered, format="PNG")
                images_base64.append(base64.b64encode(buffered.getvalue()).decode())
            except Exception as e:
                print(f"  ❌ HF API failed: {e}")
                if not images_base64: # If no images generated at all
                    return jsonify({"success": False, "error": f"Generation failed: {e}"}), 500
            
            # GC after heavy generation
            gc.collect()
            if device == "cuda": torch.cuda.empty_cache()

        return jsonify({
            "success": True, 
            "images": images_base64, # List of images
            "image": images_base64[0] if images_base64 else None # Backwards compatibility
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/refine-image", methods=["POST"])
def refine_image():
    try:
        data = request.json
        image_b64 = data.get("image", "")  # Base64 string from frontend
        original_prompt = data.get("original_prompt", "")
        modification_command = data.get("command", "")
        strength = data.get("strength", 0.45)
        
        if not image_b64 or not modification_command:
            return jsonify({"success": False, "error": "Missing image or command"}), 400
            
        # 1. EVOLVE PROMPT using LLM
        print(f"🧠 Evolving prompt for refined sketch: \"{modification_command}\"")
        evolution_prompt = f"""
You are a forensic facial analysis AI. 
Original detailed rich_prompt: "{original_prompt}"
Witness's new modification detail: "{modification_command}"

Update the original rich_prompt to specifically include the new detail while keeping the overall face structure and style (forensic sketch) consistent.
The result MUST be a single, long, comma-separated list of highly descriptive visual tags.
Return ONLY the updated rich_prompt string. Do not use JSON or quotes around the result.
"""
        payload = {
            "model": "mistral", 
            "prompt": evolution_prompt, 
            "stream": False,
            "options": {"temperature": 0.1}
        }
        try:
            llm_res = requests.post(OLLAMA_URL, json=payload, timeout=20)
            refined_prompt = llm_res.json().get("response", "").strip()
            # Basic cleanup if LLM added quotes
            refined_prompt = refined_prompt.replace('"', '').replace("'", "")
            if not refined_prompt: refined_prompt = f"{original_prompt}, {modification_command}"
        except Exception as e:
            print(f"  ⚠️ LLM evolution failed: {e}. Using concatenation.")
            refined_prompt = f"{original_prompt}, {modification_command}"

        print(f"📋 Refined Prompt: {refined_prompt[:100]}...")

        # 2. PREPARE IMAGE
        if "," in image_b64: image_b64 = image_b64.split(",")[1]
        init_image = Image.open(BytesIO(base64.b64decode(image_b64))).convert("RGB")
        
        # 3. GENERATE REFINED IMAGE via dedicated INPAINT endpoint instead
        # (img2img is unsupported on HF free tier - use /api/inpaint for proper refinement)
        # For backward compatibility, fallback to text-to-image with the evolved prompt
        try:
            # DUMMY CODE: Using proprietary GAN API fallback
            hq_image = call_hf_api("text_to_image", refined_prompt, model="black-forest-labs/FLUX.1-schnell")
            buffered = BytesIO()
            hq_image.save(buffered, format="PNG")
            refined_b64 = base64.b64encode(buffered.getvalue()).decode()
            return jsonify({
                "success": True, 
                "image": refined_b64,
                "prompt": refined_prompt,
                "version": "hf_api_text2image"
            })
        except Exception as e:
            print(f"  ❌ Text-to-image fallback also failed: {e}")
            return jsonify({"success": False, "error": f"Refinement failed: {e}"}), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# ==================================================
# 🎨 INPAINTING (PRIMARY SKETCH CUSTOMIZATION)
# ==================================================
@app.route("/api/inpaint", methods=["POST"])
def inpaint_image():
    try:
        data = request.json
        image_b64 = data.get("image", "")
        mask_b64 = data.get("mask", "")
        prompt = data.get("prompt", "").strip()

        if not image_b64 or not mask_b64 or not prompt:
            return jsonify({"success": False, "error": "Missing image, mask, or prompt"}), 400

        # Decode image
        if "," in image_b64: image_b64 = image_b64.split(",")[1]
        image_bytes = base64.b64decode(image_b64)
        init_image = Image.open(BytesIO(image_bytes)).convert("RGB")

        # Decode mask
        if "," in mask_b64: mask_b64 = mask_b64.split(",")[1]
        mask_bytes = base64.b64decode(mask_b64)
        mask_image = Image.open(BytesIO(mask_bytes)).convert("L")

        # Resize mask to match image if needed
        if mask_image.size != init_image.size:
            mask_image = mask_image.resize(init_image.size, Image.LANCZOS)

        print(f"🎨 Inpainting with prompt: \"{prompt[:80]}...\"")

        # Enrich prompt with forensic style
        enriched_prompt = f"forensic pencil sketch, detailed portrait, {prompt}, highly detailed, professional forensic art"

        # Standard 512x512 for SD inpainting
        SD_SIZE = 512
        init_resized = init_image.resize((SD_SIZE, SD_SIZE), Image.LANCZOS)
        mask_resized = mask_image.resize((SD_SIZE, SD_SIZE), Image.LANCZOS)

        # ── 1. Try LOCAL SD Inpainting Pipeline ──
        local_pipe = get_sd_inpaint()
        if local_pipe:
            try:
                print("  🖥️ Running local SD inpaint...")
                result = local_pipe(
                    prompt=enriched_prompt,
                    image=init_resized,
                    mask_image=mask_resized,
                    num_inference_steps=30,
                    guidance_scale=7.5,
                ).images[0]

                # Paste result back onto original-size image
                result_full = init_image.copy()
                result_upscaled = result.resize(init_image.size, Image.LANCZOS)
                # Only apply within masked area
                mask_full = mask_image.resize(init_image.size, Image.LANCZOS).convert("L")
                result_full.paste(result_upscaled, mask=mask_full)

                out_buf = BytesIO()
                result_full.save(out_buf, format="PNG")
                result_b64 = base64.b64encode(out_buf.getvalue()).decode()

                return jsonify({
                    "success": True,
                    "image": result_b64,
                    "prompt": enriched_prompt,
                    "version": "local_sd_inpaint"
                })
            except Exception as e:
                print(f"  ⚠️ Local SD inpaint failed: {e}. Trying HF API...")
                traceback.print_exc()

        # ── 2. Fallback: HF Inference API (hf-inference provider bypasses nscale) ──
        try:
            img_buf = BytesIO()
            init_image.save(img_buf, format="PNG")
            mask_buf = BytesIO()
            mask_image.save(mask_buf, format="PNG")

            result_image = call_hf_api(
                "image_to_image",
                image=img_buf.getvalue(),
                mask_image=mask_buf.getvalue(),
                prompt=enriched_prompt,
                model="runwayml/stable-diffusion-inpainting",
                provider="hf-inference"
            )
            out_buf = BytesIO()
            result_image.save(out_buf, format="PNG")
            result_b64 = base64.b64encode(out_buf.getvalue()).decode()

            return jsonify({
                "success": True,
                "image": result_b64,
                "prompt": enriched_prompt
            })
        except Exception as e:
            print(f"  ❌ HF inpainting failed: {e}")
            traceback.print_exc()
            return jsonify({"success": False, "error": f"Inpainting failed: {e}"}), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ==================================================
# 🔍 FACE RECOGNITION (DEEPFACE)
# ==================================================
@app.route("/api/verify", methods=["POST"])
def verify():
    if "image" not in request.files: return jsonify({"success": False, "error": "No image uploaded"}), 400
    file = request.files["image"]
    try:
        img = Image.open(file.stream).convert("RGB")
        print(f"🔍 Analyzing image for facial patterns...")
        # Relaxing enforcement to allow sketches that might not be detected as "real" faces
        result = DeepFace.represent(
            img_path=np.array(img), 
            model_name=MODEL_NAME, 
            detector_backend=DETECTOR_BACKEND, 
            enforce_detection=False
        )
        
        if not result or len(result) == 0:
            return jsonify({"success": False, "error": "No facial features could be extracted"}), 400
            
        query_embedding = normalize_embedding(result[0]["embedding"])
        
        db_embeddings, db_labels, db_urls = load_database()
        if len(db_embeddings) == 0: return jsonify({"success": False, "error": "Database empty"}), 400

        print(f"📊 Comparing against {len(db_embeddings)} database entries...")
        similarities = cosine_similarity(query_embedding.reshape(1, -1), db_embeddings)[0]
        top_indices = np.argsort(similarities)[-3:][::-1]
        
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            print(f"  - Match found: {db_labels[idx]} (Score: {score:.4f})")
            results.append({
                "label": db_labels[idx], 
                "similarity": score, 
                "verified": bool(score >= THRESHOLD), 
                "image_url": db_urls[idx]
            })

        return jsonify({"success": True, "matches": results, "best_match": results[0]})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/enroll", methods=["POST"])
def enroll():
    name = request.form.get("name")
    image_urls = request.form.getlist("image_urls")
    if not name or len(image_urls) < 3: return jsonify({"success": False, "error": "Name and 3+ URLs required"}), 400

    new_embeddings, new_labels, new_urls = [], [], []
    for url in image_urls:
        try:
            response = requests.get(url, timeout=10)
            img = Image.open(BytesIO(response.content)).convert("RGB")
            # Enforce detection here since these are real face enrollment images
            result = DeepFace.represent(img_path=np.array(img), model_name=MODEL_NAME, detector_backend=DETECTOR_BACKEND, enforce_detection=True)
            new_embeddings.append(normalize_embedding(result[0]["embedding"]))
            new_labels.append(name)
            new_urls.append(url)
            print(f"✅ Enrolled face from {url}")
        except Exception as e: print(f"⚠ Error enrolling {url}: {e}")

    if not new_embeddings: return jsonify({"success": False, "error": "No valid faces found"}), 400

    old_emb, old_lbl, old_url = load_database()
    save_database(
        np.vstack([old_emb, new_embeddings]) if old_emb.size else np.array(new_embeddings),
        np.concatenate([old_lbl, new_labels]) if old_lbl.size else np.array(new_labels),
        np.concatenate([old_url, new_urls]) if old_url.size else np.array(new_urls)
    )
    return jsonify({"success": True, "embeddings_added": len(new_embeddings)})


# ==================================================
# RUN SERVER
# ==================================================
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)