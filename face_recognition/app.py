import os
import numpy as np
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace
from sklearn.metrics.pairwise import cosine_similarity
from PIL import Image
from io import BytesIO

# ==================================================
# CONFIG
# ==================================================

EMBEDDING_DIR = "embeddings"

EMB_PATH = os.path.join(EMBEDDING_DIR, "arcface_embeddings.npy")
LBL_PATH = os.path.join(EMBEDDING_DIR, "arcface_labels.npy")
URL_PATH = os.path.join(EMBEDDING_DIR, "arcface_image_urls.npy")

MODEL_NAME = "ArcFace"
DETECTOR_BACKEND = "retinaface"
THRESHOLD = 0.55   # Lowered for Better Sketch-to-Photo Matching

os.makedirs(EMBEDDING_DIR, exist_ok=True)

app = Flask(__name__)
CORS(app)

print("🚀 Backend Started (Firebase Storage Mode)")


# ==================================================
# UTILITIES
# ==================================================

def normalize_embedding(emb):
    emb = np.array(emb)
    norm = np.linalg.norm(emb)
    if norm == 0:
        return emb
    return emb / norm


def load_database():
    """
    Safe loading.
    If files don't exist (first run), initialize empty arrays.
    """

    if os.path.exists(EMB_PATH) and \
       os.path.exists(LBL_PATH) and \
       os.path.exists(URL_PATH):

        embeddings = np.load(EMB_PATH)
        labels = np.load(LBL_PATH)
        urls = np.load(URL_PATH)

    else:
        embeddings = np.empty((0, 512))
        labels = np.empty((0,), dtype=str)
        urls = np.empty((0,), dtype=str)

    return embeddings, labels, urls


def save_database(embeddings, labels, urls):
    np.save(EMB_PATH, embeddings)
    np.save(LBL_PATH, labels)
    np.save(URL_PATH, urls)


# ==================================================
# ENROLL ENDPOINT
# ==================================================

@app.route("/api/enroll", methods=["POST"])
def enroll():

    name = request.form.get("name")
    image_urls = request.form.getlist("image_urls")

    if not name or len(image_urls) < 3:
        return jsonify({
            "success": False,
            "error": "Name and minimum 3 image URLs required"
        }), 400

    new_embeddings = []
    new_labels = []
    new_urls = []

    for url in image_urls:
        try:
            # Download image from Firebase
            response = requests.get(url)
            img = Image.open(BytesIO(response.content)).convert("RGB")

            # Extract embedding
            result = DeepFace.represent(
                img_path=np.array(img),
                model_name=MODEL_NAME,
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=True
            )

            embedding = normalize_embedding(result[0]["embedding"])

            new_embeddings.append(embedding)
            new_labels.append(name)
            new_urls.append(url)

            print(f"✅ Processed: {url}")

        except Exception as e:
            print("⚠ Error processing:", url)
            print("   ", e)

    if len(new_embeddings) == 0:
        return jsonify({
            "success": False,
            "error": "No valid faces found"
        }), 400

    # Load old database
    old_embeddings, old_labels, old_urls = load_database()

    # Merge
    if len(old_embeddings) == 0:
        all_embeddings = np.array(new_embeddings)
        all_labels = np.array(new_labels)
        all_urls = np.array(new_urls)
    else:
        all_embeddings = np.vstack([old_embeddings, new_embeddings])
        all_labels = np.concatenate([old_labels, new_labels])
        all_urls = np.concatenate([old_urls, new_urls])

    # Save updated database
    save_database(all_embeddings, all_labels, all_urls)

    return jsonify({
        "success": True,
        "embeddings_added": len(new_embeddings),
        "total_embeddings": len(all_embeddings)
    })


# ==================================================
# VERIFY ENDPOINT
# ==================================================

@app.route("/api/verify", methods=["POST"])
def verify():

    if "image" not in request.files:
        return jsonify({
            "success": False,
            "error": "No image uploaded"
        }), 400

    file = request.files["image"]

    try:
        img = Image.open(file.stream).convert("RGB")

        result = DeepFace.represent(
            img_path=np.array(img),
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True
        )

        query_embedding = normalize_embedding(result[0]["embedding"])

        db_embeddings, db_labels, db_urls = load_database()

        if len(db_embeddings) == 0:
            return jsonify({
                "success": False,
                "error": "Database empty"
            }), 400

        similarities = cosine_similarity(
            query_embedding.reshape(1, -1),
            db_embeddings
        )[0]

        # Get top 3 matches
        top_indices = np.argsort(similarities)[-3:][::-1]
        results = []
        
        for idx in top_indices:
            score = float(similarities[idx])
            results.append({
                "label": db_labels[idx],
                "similarity": score,
                "verified": bool(score >= THRESHOLD),
                "image_url": db_urls[idx]
            })

        return jsonify({
            "success": True,
            "matches": results,
            "best_match": results[0] # For backward compatibility
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==================================================

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5007, debug=False)