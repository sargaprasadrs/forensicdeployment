from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

# ==================================================
# FLASK APP SETUP
# ==================================================
app = Flask(__name__)
CORS(app)

# Ollama local API endpoint
OLLAMA_URL = "http://localhost:11434/api/generate"

print("Local Mistral LLM backend ready 🚀")

# ==================================================
# LLM FACIAL FEATURE EXTRACTION ENDPOINT
# ==================================================
@app.route("/api/llm-extract", methods=["POST"])
def extract_features():
    try:
        data = request.json
        text = data.get("text", "").strip()

        if not text:
            return jsonify({
                "success": False,
                "error": "Empty text"
            }), 400

        # -------------------------------
        # PROMPT (STRICT + SAFE)
        # -------------------------------
        prompt = f"""
You are a forensic facial analysis AI.

Extract facial attributes ONLY if they are clearly stated or unambiguously implied.
Do NOT guess or hallucinate.
If a feature is not mentioned, set its value to "unknown".

Return ONLY valid JSON using EXACTLY this schema.
Do NOT add explanations or extra text.

Schema:
{{
  "face_shape": "unknown",
  "face_structure": "unknown",
  "jawline": "unknown",
  "cheekbones": "unknown",
  "eyes": "unknown",
  "brow_ridge": "unknown",
  "nose_shape": "unknown",
  "nose_tip": "unknown",
  "nose_asymmetry": "unknown",
  "hair_thickness": "unknown",
  "hair_color": "unknown",
  "hairline": "unknown",
  "hair_part": "unknown",
  "scars": "unknown",
  "scar_location": "unknown",
  "dental_alignment": "unknown",
  "central_tooth": "unknown",
  "facial_fullness": "unknown",
  "overall_appearance": "unknown"
}}

Description:
\"\"\"{text}\"\"\"
"""

        payload = {
            "model": "mistral",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1
            }
        }

        # Call Ollama
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=60
        )

        if response.status_code != 200:
            return jsonify({
                "success": False,
                "error": response.text
            }), 500

        result = response.json()

        # Ollama returns text in "response"
        features = json.loads(result["response"])

        return jsonify({
            "success": True,
            "features": features
        })

    except json.JSONDecodeError:
        return jsonify({
            "success": False,
            "error": "Model did not return valid JSON"
        }), 500

    except Exception as e:
        print("ERROR:", e)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==================================================
# RUN SERVER
# ==================================================
if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5003,
        debug=False
    )

