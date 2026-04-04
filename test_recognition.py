import requests
import os

url = "http://127.0.0.1:5000/api/verify"
# We'll use a local image if possible, or just a placeholder
# For testing purposes, we can try to send any image.

# Let's find an image in the project to test with.
test_img = "src/assets/mic.png" # Just to see if it processes it without crashing

if os.path.exists(test_img):
    with open(test_img, "rb") as f:
        files = {"image": f}
        try:
            r = requests.post(url, files=files)
            print(f"Status: {r.status_code}")
            print(f"Response: {r.json()}")
        except Exception as e:
            print(f"Error: {e}")
else:
    print(f"File {test_img} not found")
