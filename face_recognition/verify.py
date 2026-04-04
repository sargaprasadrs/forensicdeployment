from flask import Blueprint, request, jsonify
from deepface import DeepFace
import numpy as np
import tempfile
import os
from sklearn.metrics.pairwise import cosine_similarity

verify_bp = Blueprint("verify", __name__)

EMB_PATH = "embeddings/arcface_embeddings.npy"
LBL_PATH = "embeddings/arcface_labels.npy"
THRESHOLD = 0.75

@verify_bp.route("/api/verify", methods=["POST"])
def verify():

    if "image" not in request.files:
        return jsonify({"success": False})

    file = request.files["image"]

    temp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
    file.save(temp.name)

    try:
        result = DeepFace.represent(
            img_path=temp.name,
            model_name="ArcFace",
            detector_backend="retinaface",
            enforce_detection=True
        )

        query = np.array(result[0]["embedding"])
        query = query / np.linalg.norm(query)

        db_emb = np.load(EMB_PATH)
        db_lbl = np.load(LBL_PATH)

        sims = cosine_similarity(query.reshape(1, -1), db_emb)[0]

        best_idx = np.argmax(sims)
        best_score = sims[best_idx]

        return jsonify({
            "success": True,
            "label": db_lbl[best_idx],
            "similarity": float(best_score),
            "verified": best_score >= THRESHOLD
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

    finally:
        os.unlink(temp.name)