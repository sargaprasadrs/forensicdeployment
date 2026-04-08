# Forensic Sketching

This project uses:

- a React frontend
- a unified Python backend in `server/main.py`
- Ollama for local LLM extraction with the `mistral` model
- Hugging Face for model access and fallbacks
- Firebase for auth, Firestore, and storage

## What Actually Runs

For the current app flow, the main service is `server/main.py`.

The folders `backend`, `backend2`, `LLM backend`, and `face_recognition` are older split services or experiments. You do not need to run them separately for the main app.

## Prerequisites

Install these first on the target machine:

- Python 3.10 or newer
- Node.js and npm
- Git
- Ollama

Optional but helpful:

- FFmpeg in `PATH` if audio transcription has decoding issues
- A CUDA-capable GPU for faster image generation

## Windows Setup Order

Use this order on a fresh Windows system.

1. Clone the repository and open it in PowerShell:

```powershell
git clone <your-repo-url>
cd forensic_sketching
```

2. Create the virtual environment:

```powershell
python -m venv venv
```

3. Activate the virtual environment:

```powershell
.\venv\Scripts\Activate.ps1
```

If you are using Command Prompt instead of PowerShell:

```bat
venv\Scripts\activate
```

4. Upgrade `pip`:

```powershell
python -m pip install --upgrade pip
```

5. Install the Python dependencies:

```powershell
pip install -r requirements.txt
```

6. Install frontend dependencies:

```powershell
npm install
```

7. Create a `.env` file in the project root from `.env.example` and add your Hugging Face token:

```env
HF_TOKEN=your_token_here
```

You can get a token from `https://huggingface.co/settings/tokens`.

8. Install and prepare Ollama, then download the `mistral` model:

```powershell
ollama pull mistral
```

Make sure Ollama is running before you start the app.

## Notes About The Commands You Shared

- `python -m pip install python-dotenv` is usually not needed separately because `python-dotenv` is already included in `requirements.txt`.
- `python -m venv venv` only needs to be run once when creating the environment.
- `pip install protobuf==3.20.3` is now already covered by `requirements.txt`, so you normally do not need to run it manually on a fresh setup.
- This repo currently has `run.bat`, not `run_project.bat`.
- If you want to activate the venv with a full path, this also works:

```powershell
& "C:\path\to\forensic_sketching\venv\Scripts\Activate.ps1"
```

## Running The Project

### Option 1: Use the included Windows launcher

```bat
run.bat
```

This launcher:

- checks Python
- creates `venv` if missing
- installs `requirements.txt` if needed
- installs Node dependencies if needed
- starts `server/main.py`
- starts the React frontend

### Option 2: Run manually

Start the backend in one terminal:

```powershell
python server/main.py
```

Start the frontend in another terminal:

```powershell
npm start
```

The frontend runs at `http://localhost:3000`.

The backend runs at `http://127.0.0.1:5000`.

## Ollama And Model Requirements

The unified backend calls Ollama at `http://localhost:11434/api/generate` and expects the `mistral` model to be available locally.

If Ollama is not running, LLM-based facial feature extraction and prompt refinement will fail.

## Hugging Face And FLUX

This project can also use Hugging Face-hosted generation and local FLUX model downloads.

If you want the optional local FLUX model:

1. Accept the model terms for `black-forest-labs/FLUX.1-schnell` on Hugging Face.
2. Add `HF_TOKEN` to your environment.
3. Run:

```bat
download_model.bat
```

This download is large, around 23 GB, and needs enough disk space.

## Troubleshooting

- If PowerShell blocks activation scripts, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then activate the venv again.

- If the backend complains about missing Ollama, start the Ollama app and confirm `ollama pull mistral` completed successfully.
- If image generation fails, verify your `HF_TOKEN` is valid.
- If setup becomes inconsistent, delete the existing `venv`, create it again, reactivate it, and reinstall from `requirements.txt`.
