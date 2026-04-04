from flask import Blueprint, request, jsonify
from deepface import DeepFace
import numpy as np
import os
import tempfile

enroll_bp = Blueprint("enroll", __name__)

EMB_PATH = "embeddings/arcface_embeddings.npy"
LBL_PATH = "embeddings/arcface_labels.npy"

@enroll_bp.route("/api/enroll", methods=["POST"])
def enroll():

    name = request.form.get("name")
    files = request.files.getlist("images")

    if len(files) < 3:
        return jsonify({"success": False, "error": "Minimum 3 images required"})

    new_embeddings = []
    new_labels = []

    for file in files:
        temp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
        file.save(temp.name)

        try:
            result = DeepFace.represent(
                img_path=temp.name,
                model_name="ArcFace",
                detector_backend="retinaface",
                enforce_detection=True
            )

            emb = np.array(result[0]["embedding"])
            emb = emb / np.linalg.norm(emb)

            new_embeddings.append(emb)
            new_labels.append(name)

        except:
            pass

        os.unlink(temp.name)

    if len(new_embeddings) == 0:
        return jsonify({"success": False})

    # Load old
    if os.path.exists(EMB_PATH):
        old_emb = np.load(EMB_PATH)
        old_lbl = np.load(LBL_PATH)
    else:
        old_emb = np.empty((0, 512))
        old_lbl = np.empty((0,), dtype=str)

    all_emb = np.vstack([old_emb, new_embeddings])
    all_lbl = np.concatenate([old_lbl, new_labels])

    np.save(EMB_PATH, all_emb)
    np.save(LBL_PATH, all_lbl)

    return jsonify({
        "success": True,
        "embeddings_added": len(new_embeddings),
        "total_embeddings": len(all_emb)
    })