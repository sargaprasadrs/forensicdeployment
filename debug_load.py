import torch
from diffusers import StableDiffusionPipeline
import os

print("Testing StableDiffusionPipeline.from_pretrained...")
try:
    pipe = StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        torch_dtype=torch.float32,
        low_cpu_mem_usage=True
    )
    print("Pipeline loaded successfully!")
except Exception as e:
    print(f"Error loading pipeline: {e}")
    import traceback
    traceback.print_exc()
