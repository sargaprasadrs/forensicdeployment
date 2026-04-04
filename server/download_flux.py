
import os
from huggingface_hub import snapshot_download
from dotenv import load_dotenv

# Load environment variables (from the same directory as the script)
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path)

def download_model():
    model_id = "black-forest-labs/FLUX.1-schnell"
    local_dir = os.path.join(os.path.dirname(__file__), "models", "flux")
    
    token = os.getenv("HF_TOKEN")
    if not token or token == "your_token_here":
        print("❌ Error: HF_TOKEN not found in .env file.")
        print("Please add your Hugging Face token to server/.env and accept the model terms on the HF website.")
        return

    print(f"🚀 Starting download of {model_id} to {local_dir}...")
    print("This is ~23GB. Please ensure you have enough disk space and a stable connection.")
    
    try:
        snapshot_download(
            repo_id=model_id,
            local_dir=local_dir,
            local_dir_use_symlinks=False,
            token=token,
            ignore_patterns=["*.msgpack", "*.h5"] # Save space
        )
        print("\n✅ Download complete! You can now run the server.")
    except Exception as e:
        print(f"\n❌ Download failed: {e}")

if __name__ == "__main__":
    download_model()
