import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"

text = "A man with a square face, short black hair, and thick eyebrows."
gender_context = "man"

prompt = f"""
You are a forensic facial analysis AI.

Extract facial attributes ONLY if they are clearly stated or unambiguously implied.
Do NOT guess or hallucinate.
If a feature is not mentioned, set its value to "unknown".

Also, generate a "rich_prompt" for Stable Diffusion. This "rich_prompt" should be a 
comma-separated list of highly descriptive visual tags that capture EVERY detail 
from the witness description (including face shape, hair, eyes, nose, clothing, 
accessories, lighting, and any unique identifiers).

Return ONLY valid JSON using EXACTLY this schema.
Do NOT add explanations or extra text.

Schema:
{{
  "face_shape": "unknown",
  "hair": "unknown",
  "eyes": "unknown",
  "complexion": "unknown",
  "key_marks": "unknown",
  "attire": "unknown",
  "rich_prompt": "highly detailed portrait of a {gender_context}"
}}

Description:
\"\"\"{text}\"\"\"
"""

payload = {"model": "mistral", "prompt": prompt, "stream": False, "format": "json", "options": {"temperature": 0.1}}

try:
    r = requests.post(OLLAMA_URL, json=payload, timeout=60)
    print(f"Status: {r.status_code}")
    raw_response = r.json()["response"]
    print("--- RAW RESPONSE ---")
    print(raw_response)
    print("--- END RAW RESPONSE ---")
    
    try:
        json_res = json.loads(raw_response)
        print("Success: JSON parsed correctly!")
    except Exception as e:
        print(f"Failed: {e}")
except Exception as e:
    print(f"Request failed: {e}")
