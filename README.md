# Forensic Sketching

This project combines a React frontend with a Python backend for the forensic sketching workflow.

## Prerequisites

Make sure the target system has:

- Python 3.10 or newer
- Node.js and npm
- Git

## Setup on a New System

1. Clone the repository and move into the project folder:

```bash
git clone <your-repo-url>
cd forensic_sketching
```

2. Create a Python virtual environment:

```bash
python -m venv venv
```

3. Activate the virtual environment:

Windows:

```bat
venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

4. Install the Python dependencies:

```bash
pip install -r requirements.txt
```

5. Install the frontend dependencies:

```bash
npm install
```

## Running the Project

### Option 1: Use the Windows launcher

On Windows, you can use the included launcher:

```bat
run.bat
```

This script will:

- create the virtual environment if it does not exist
- install Python requirements if needed
- install Node dependencies if needed
- start the Python backend
- start the React frontend

### Option 2: Start services manually

Start the Python backend:

```bash
python server/main.py
```

In a separate terminal, start the React frontend:

```bash
npm start
```

The frontend runs at `http://localhost:3000`.

## Notes

- If `pip` is outdated, you can upgrade it with `python -m pip install --upgrade pip`.
- Keep the virtual environment activated whenever you work on the Python backend.
- If you are setting this up on a new machine, install all dependencies again inside the new virtual environment.
