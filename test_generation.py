import requests
import json
import time

def test_generation():
    url = "http://127.0.0.1:5000/api/generate-image"
    # Use a small count to test
    data = {
        "prompt": "highly detailed portrait of a man with short brown hair, wearing a black jacket",
        "negative_prompt": "blurry, low quality",
        "mode": "flux_hq",
        "count": 1
    }
    
    try:
        print(f"Triggering generation at {url}...")
        print("This will trigger FLUX model loading. Watch the server console!")
        response = requests.post(url, json=data, timeout=300) # Long timeout for model load
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success!")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error during request: {e}")

if __name__ == "__main__":
    test_generation()
