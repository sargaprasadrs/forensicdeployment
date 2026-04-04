@echo off
echo =======================================================
echo FLUX Model Downloader for Forensic Sketch
echo =======================================================
echo This will download ~23GB of model weights to server/models/flux.
echo Please ensure you have accepted the terms at:
echo https://huggingface.co/black-forest-labs/FLUX.1-schnell
echo and updated HF_TOKEN in server/.env
echo =======================================================
pause
python server/download_flux.py
pause
