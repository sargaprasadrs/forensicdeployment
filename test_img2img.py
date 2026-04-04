import os
import requests
import base64
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv("server/.env")
HF_TOKEN = os.getenv("HF_TOKEN")
client = InferenceClient(model="black-forest-labs/FLUX.1-schnell", token=HF_TOKEN)

def test_img2img():
    print("🚀 Step 1: Generating Initial Portrait...")
    prompt = "forensic pencil sketch of a middle-aged man with sharp features, short hair, detective style"
    
    # Generate initial image
    image = client.text_to_image(prompt)
    image.save("original.png")
    print("✅ Original saved as original.png")

    print("\n🚀 Step 2: Refining via Img2Img (Adding a Scar)...")
    # For FLUX on HF API, we might need a specific endpoint or use the general image_to_image
    # Note: Some models on HF API use different parameters for img2img.
    # If the default client.image_to_image is not available for FLUX.1-schnell on the free tier, 
    # we simulate the logic or use a compatible model.
    
    try:
        # Refinement prompt
        refined_prompt = "forensic pencil sketch of a middle-aged man with sharp features, short hair, detective style, ADD A LARGE SCAR ON HIS LEFT CHEEK"
        
        # We use a strength of 0.5 to keep the face but add the scar
        # Note: HF InferenceClient image_to_image might require the image as bytes
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        
        # Using the recommended approach for HF Img2Img
        refined_image = client.image_to_image(
            image=buffered.getvalue(),
            prompt=refined_prompt,
            strength=0.5
        )
        
        refined_image.save("refined_scar.png")
        print("✅ Refined image saved as refined_scar.png")
        print("\n✨ SUCCESS: If both images look like the same man, Img2Img works!")
        
    except Exception as e:
        print(f"❌ Error during Img2Img: {e}")
        print("Note: If the specific FLUX endpoint doesn't support Img2Img on the free tier, we'll implement it locally in the main app.")

if __name__ == "__main__":
    if not HF_TOKEN:
        print("❌ HF_TOKEN not found in .env")
    else:
        test_img2img()
