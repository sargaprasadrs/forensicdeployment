import requests
import json

def test_extraction():
    url = "http://127.0.0.1:5000/api/llm-extract"
    data = {"text": "A man with short brown hair and blue eyes, wearing a black jacket."}
    
    try:
        print(f"Testing {url}...")
        response = requests.post(url, json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_extraction()
