from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from diffusers import StableDiffusionPipeline
import base64
from io import BytesIO

app = Flask(__name__)
CORS(app)

device = "cuda" if torch.cuda.is_available() else "cpu"

pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=torch.float16 if device == "cuda" else torch.float32
)
pipe = pipe.to(device)

@app.route("/api/generate-image", methods=["POST"])
def generate_image():
    data = request.json
    prompt = data.get("prompt", "").strip()
    negative_prompt = data.get("negative_prompt", "").strip()

    if not prompt:
        return jsonify({"success": False, "error": "Empty prompt"}), 400

    image = pipe(
        prompt, 
        negative_prompt=negative_prompt if negative_prompt else None,
        num_inference_steps=50, 
        guidance_scale=7.5
    ).images[0]

    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()

    return jsonify({
        "success": True,
        "image": img_base64
    })

if __name__ == "__main__":
    app.run(port=5006)
