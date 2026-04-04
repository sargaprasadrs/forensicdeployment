import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"

def test_ollama(model_name):
    payload = {
        "model": model_name,
        "prompt": "Say hello",
        "stream": False
    }
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=10)
        print(f"Testing model {model_name}...")
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            print(f"Response: {r.json().get('response')}")
        else:
            print(f"Error: {r.text}")
    except Exception as e:
        print(f"Request failed: {e}")

print("--- Testing Mistral ---")
test_ollama("mistral")
print("\n--- Testing Llama3 ---")
test_ollama("llama3")
