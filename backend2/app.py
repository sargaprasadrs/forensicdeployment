from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
from huggingface_hub import login
import nltk
import os
from sklearn.metrics.pairwise import cosine_similarity
from nltk.tokenize import word_tokenize
from nltk.util import ngrams

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ==================================================
# HUGGING FACE AUTHENTICATION
# ==================================================
HF_TOKEN = os.getenv("HF_TOKEN")
if HF_TOKEN:
    login(token=HF_TOKEN)

# ==================================================
# NLTK SETUP (WINDOWS SAFE)
# ==================================================
nltk_data_path = "C:/Users/swath/AppData/Roaming/nltk_data"
os.makedirs(nltk_data_path, exist_ok=True)
nltk.data.path.insert(0, nltk_data_path)

def download_nltk(pkg):
    try:
        nltk.data.find(f"tokenizers/{pkg}")
    except LookupError:
        nltk.download(pkg, download_dir=nltk_data_path)

download_nltk("punkt")

# ==================================================
# FLASK APP
# ==================================================
app = Flask(__name__)
CORS(app)

print("Loading SentenceTransformer (all-MiniLM-L6-v2)...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Semantic Feature Extraction Backend Ready 🚀")

# ==================================================
# SEMANTIC FEATURE EXTRACTION (NO KEYWORDS)
# ==================================================
@app.route("/api/semantic-extract", methods=["POST"])
def semantic_extract():
    try:
        data = request.json
        text = data.get("text", "").strip()

        if not text:
            return jsonify({"success": False, "error": "Empty text"}), 400

        tokens = word_tokenize(text.lower())

        # Generate candidate phrases (1–3 grams)
        candidates = set()
        for n in (1, 2, 3):
            for gram in ngrams(tokens, n):
                phrase = " ".join(gram)
                if phrase.replace(" ", "").isalpha():
                    candidates.add(phrase)

        candidates = list(candidates)
        if not candidates:
            return jsonify({"success": True, "features": [], "count": 0})

        # Encode text and candidates
        text_embedding = model.encode([text])
        candidate_embeddings = model.encode(candidates)

        similarities = cosine_similarity(
            text_embedding, candidate_embeddings
        )[0]

        ranked = sorted(
            zip(candidates, similarities),
            key=lambda x: x[1],
            reverse=True
        )

        extracted = []
        for phrase, score in ranked:
            if score > 0.45:
                extracted.append(phrase)
            if len(extracted) >= 10:
                break

        return jsonify({
            "success": True,
            "features": extracted,
            "count": len(extracted)
        })

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"success": False, "error": str(e)}), 500

# ==================================================
# RUN SERVER
# ==================================================
if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5002,
        debug=False,
        threaded=True,
        use_reloader=False
    )
