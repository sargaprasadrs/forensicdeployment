# FaceTrace: AI-Driven Suspect Sketch & Photorealistic Face Creator

![FaceTrace Workflow](https://img.shields.io/badge/AI-Forensic--Sketching-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Python](https://img.shields.io/badge/Python-3.10%2B-brightgreen)
![React](https://img.shields.io/badge/React-18-61dafb)

**FaceTrace** is an advanced AI-powered forensic system designed to convert verbal or textual witness descriptions into photorealistic facial images of suspects and automatically match them against law enforcement criminal databases. By combining Automatic Speech Recognition (ASR), Natural Language Processing (NLP), Generative Adversarial Networks (GANs) / Diffusion Models, and Deep Face Recognition embeddings, FaceTrace drastically reduces reliance on traditional manual sketch artists and accelerates investigative workflows.

---

## 📚 Project Documentation & References

- **Full SRS & SDD Documentation (Google Drive)**: [FaceTrace Documentation Folder](https://drive.google.com/drive/folders/1Gg-lUnFcmE60WEJxYqWy1vV19S4Zmk7N?usp=sharing)
- **Software Requirement Specification (SRS)**: Formally defines functional/non-functional requirements, acceptance criteria, performance metrics, and user interfaces.
- **Software Design Description (SDD)**: Outlines high-level architecture, low-level UML analysis/design models (sequence, state transition, collaboration, class diagrams), and complete ER database schemas.

---

## 🔄 System Architecture & Workflows

### 1. High-Level System Workflow Diagram
The following flowchart illustrates the linear, 5-stage pipeline transforming witness testimony into actionable suspect identification:

```mermaid
graph TD
    subgraph InputStage["1. Input Handling Stage"]
        A[Witness Description] --> B1["Speech Input (Microphone)"]
        A --> B2["Text Input (Written Description)"]
        B1 --> C1["Automatic Speech Recognition (ASR / Whisper)"]
    end

    subgraph ProcessingStage["2. NLP & Attribute Processing"]
        C1 --> D["NLP Feature Extraction (Ollama / Mistral / BERT)"]
        B2 --> D
        D --> E["Attribute Encoder (Latent Feature Vector)"]
    end

    subgraph GenerationStage["3. Face Synthesis & Iterative Refinement"]
        E --> F["Generative AI Models (FLUX.1 / Stable Diffusion / StyleGAN)"]
        F --> G["Rough Sketch / Initial Composite Preview"]
        G --> H["AI Refinement Engine (Text Prompts & Sliders)"]
        H --> I["Photorealistic Face Image Output"]
    end

    subgraph MatchingStage["4. Forensic Database Matching"]
        I --> J["Face Embeddings Extractor (ArcFace / FaceNet)"]
        J --> K[("Criminal Database Gallery")]
        K --> L["Similarity Search (FAISS / Cosine Similarity)"]
    end

    subgraph OutputStage["5. Investigation Output & Audit"]
        L --> M["Ranked Match Suggestions with Confidence Scores"]
        M --> N["Investigator Case Review & Report Export"]
    end
```

---

### 2. Collaboration & Component Data-Flow Diagram
Illustrates how independent system modules (Frontend, ASR, NLP Engine, Latent Encoder, Generator, Matcher, Security Audit) communicate seamlessly:

```mermaid
flowchart LR
    User([Investigator / Witness]) -->|Voice / Text Input| UI["Web UI Frontend (React)"]
    UI -->|Audio Payload| ASR["ASR Engine (Whisper)"]
    ASR -->|Text Transcript| NLP["NLP Module (Ollama / BERT)"]
    UI -->|Direct Text| NLP
    NLP -->|Facial Attributes| Enc["Attribute Encoder"]
    Enc -->|Latent Vector| Gen["Image Generator (FLUX / SD / GAN)"]
    Gen -->|Generated Face| Matcher["Matcher Engine (ArcFace)"]
    DB[("Criminal Database")] <-->|Gallery Images & Embeddings| Matcher
    Matcher -->|Ranked Matches & Match %| UI
    UI -->|Access Control & Logs| Audit["Audit & Security Module"]
    Audit -->|Encrypted Audit Logs| DB
```

---

### 3. End-to-End Sequence Diagram (Analysis Model)
Detailed message flow across components during witness interaction, facial feature extraction, face synthesis, and database matching:

```mermaid
sequenceDiagram
    autonumber
    actor User as Witness / Investigator
    participant UI as Web UI Frontend
    participant Backend as Backend Server (server/main.py)
    participant NLP as NLP Engine (Ollama / Whisper)
    participant Gen as Face Generator (FLUX / SD)
    participant MatchEngine as Match Engine (ArcFace)
    participant DB as Criminal Database

    User->>UI: Input Witness Description (Voice or Text)
    alt Speech Input
        UI->>Backend: Post Audio Buffer (/api/transcribe)
        Backend->>NLP: Transcribe Speech (Whisper ASR)
        NLP-->>Backend: Return Text Transcript
    end
    Backend->>NLP: Extract Structured Attributes (Ollama Mistral)
    NLP-->>Backend: Return JSON Attributes (hair, eyes, nose, skin, age)
    Backend-->>UI: Render Identified Attributes

    User->>UI: Review/Refine Attributes & Click "Generate Sketch"
    UI->>Backend: Request Face Synthesis (/api/generate)
    Backend->>Gen: Pass Latent Vector to Pipeline
    Gen-->>Backend: Return Synthetic Face Image (Base64)
    Backend-->>UI: Display Photorealistic Suspect Face

    User->>UI: Click "Match with Criminal Database"
    UI->>Backend: Initiate Matching Request (/api/match)
    Backend->>MatchEngine: Compute ArcFace Embedding Vector (512-d)
    MatchEngine->>DB: Query Pre-computed Criminal Embeddings
    DB-->>MatchEngine: Return Top-K Candidates with Cosine Distance
    MatchEngine-->>Backend: Format Ranked Results & Confidence Scores
    Backend-->>UI: Display Ranked Matches & Suspect Profiles
```

---

### 4. System Use Case Diagram
Maps the roles and operational permissions for Eyewitnesses, Forensic Investigators, and System Administrators:

```mermaid
graph LR
    subgraph Actors
        Eyewitness(("Eyewitness (Secondary)"))
        Officer(("Forensic Investigator (Primary)"))
        Admin(("System Admin (Tertiary)"))
    end

    subgraph FaceTrace System Capabilities
        UC1["Register / Login"]
        UC2["Provide Witness Description (Text / Voice)"]
        UC3["Extract & Refine Facial Attributes"]
        UC4["Generate Suspect Sketch / Photo"]
        UC5["Match Face against Criminal Database"]
        UC6["View & Export Case Reports"]
        UC7["Manage Role-Based Access Control"]
        UC8["Monitor System & Security Logs"]
        UC9["Maintain Criminal Gallery Database"]
    end

    Eyewitness --> UC2
    Officer --> UC1
    Officer --> UC2
    Officer --> UC3
    Officer --> UC4
    Officer --> UC5
    Officer --> UC6
    Admin --> UC1
    Admin --> UC7
    Admin --> UC8
    Admin --> UC9
```

---

### 5. State Transition Diagram
Represents the operational state lifecycle of the system during an investigative session:

```mermaid
stateDiagram-v2
    [*] --> Idle: Application Launch
    Idle --> SpeechInput: Select Voice Mode
    Idle --> TextInput: Select Text Mode

    SpeechInput --> SpeechToText: Record & Send Audio
    SpeechToText --> SpeechInput: Audio Unclear (Retry Prompt)
    SpeechToText --> FeatureExtraction: Audio Transcribed

    TextInput --> FeatureExtraction: Submit Text Description

    FeatureExtraction --> SpeechInput: No Valid Attributes Found
    FeatureExtraction --> SketchGeneration: Features Successfully Parsed

    SketchGeneration --> RealisticImageGeneration: Render Initial Composite
    RealisticImageGeneration --> AttributeRefinement: Prompt / Slider Tweaks
    AttributeRefinement --> RealisticImageGeneration: Re-synthesize Face

    RealisticImageGeneration --> DatabaseMatching: Confirm Final Suspect Face
    DatabaseMatching --> ResultDisplay: Compute Embeddings & Search DB
    ResultDisplay --> [*]: Save Case & Export Investigation Report
```

---

### 6. Entity-Relationship (ER) Database Model
The relational database schema for managing eyewitness input, generated sketches, realistic faces, criminal galleries, and match logs:

```mermaid
erDiagram
    EYEWITNESS {
        int eyewitness_id PK
        string name
        int age
        string gender
        string description
    }

    GENERATED_SKETCH {
        int sketch_id PK
        int eyewitness_id FK
        string features
        datetime created_at
    }

    REALISTIC_FACE {
        int face_id PK
        int sketch_id FK
        string image_path
        datetime generated_at
        float confidence_score
    }

    CRIMINAL_DATABASE {
        int criminal_id PK
        string name
        string gender
        string records
        string embedding_path
    }

    MATCH_RESULT {
        int result_id PK
        int face_id FK
        int criminal_id FK
        float match_percentage
        datetime created_at
    }

    EYEWITNESS ||--o{ GENERATED_SKETCH : "provides_input_for"
    GENERATED_SKETCH ||--|| REALISTIC_FACE : "refined_into"
    REALISTIC_FACE ||--o{ MATCH_RESULT : "matched_to"
    CRIMINAL_DATABASE ||--o{ MATCH_RESULT : "compared_in"
```

---

### 7. Software Class Diagram (Low-Level Design)
Represents the static structure, object attributes, methods, and relationships of the software components:

```mermaid
classDiagram
    class User {
        +int userId
        +String username
        +String password
        +String role
        +login() bool
        +logout() void
        +submitDescription(SuspectDescription) void
        +generateSuspectFace() void
        +viewGeneratedFace() Image
    }

    class Admin {
        +int adminId
        +String username
        +String password
        +manageUsers() void
        +updateModel() void
        +viewReports() void
    }

    class SuspectDescription {
        +int descriptionId
        +int userId
        +String ageRange
        +String gender
        +String hairType
        +String eyeColor
        +String skinTone
        +String facialFeatures
        +String additionalNotes
        +validateDescription() bool
    }

    class FaceGenerationEngine {
        +Object model
        +float confidenceLevel
        +generateFace(SuspectDescription) GeneratedFace
        +updateModel(Object) void
        +evaluateAccuracy() float
    }

    class GeneratedFace {
        +int faceId
        +int descriptionId
        +String imagePath
        +Date generationDate
        +float confidenceScore
        +displayFace() void
        +compareWithDatabase() bool
    }

    class CriminalDatabase {
        +int criminalId
        +String name
        +String gender
        +String records
        +searchByEmbedding(Array) MatchResult
    }

    class MatchResult {
        +int resultId
        +int faceId
        +int criminalId
        +float similarityScore
        +Date createdAt
        +exportReport() void
    }

    class Feedback {
        +int feedbackId
        +int userId
        +int faceId
        +String comment
        +float accuracyRating
        +submitFeedback() void
    }

    Admin --|> User : Inherits
    User "1" -- "0..*" SuspectDescription : submits
    SuspectDescription "1" -- "1" FaceGenerationEngine : analyzed by
    FaceGenerationEngine "1" -- "0..*" GeneratedFace : generates
    GeneratedFace "1" -- "0..*" MatchResult : produces
    CriminalDatabase "1" -- "0..*" MatchResult : compared in
    User "1" -- "0..*" Feedback : provides
    GeneratedFace "1" -- "0..*" Feedback : receives
```

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18, HTML5, CSS3 / Custom Design System, Electron integration.
- **Backend Service**: Python Flask (`server/main.py`), PyTorch, CUDA acceleration.
- **Speech Recognition (ASR)**: OpenAI Whisper (`faster-whisper`).
- **NLP Feature Extraction**: Local Ollama LLM (`mistral` model) & HuggingFace Transformers.
- **Generative AI Models**: `black-forest-labs/FLUX.1-schnell`, Stable Diffusion Inpainting, StyleGAN / Pix2Pix baselines.
- **Face Recognition & Matching**: DeepFace framework, ArcFace model embeddings (`retinaface` backend), FAISS / Cosine Similarity distance metrics.
- **Authentication & Database**: Firebase Auth, Firestore, Encrypted Local/Cloud Storage.

---

## 🚀 Quick Start Guide

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** & `npm`
- **Git**
- **Ollama** (for local LLM extraction)
- *(Optional)* NVIDIA GPU with CUDA drivers & FFmpeg in `PATH`

---

### Windows Setup Instructions

1. **Clone the Repository & Navigate to Folder**:
   ```powershell
   git clone <your-repo-url>
   cd forensic_sketch_final
   ```

2. **Create & Activate Virtual Environment**:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

3. **Install Dependencies**:
   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   npm install
   ```

4. **Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   HF_TOKEN=your_huggingface_token_here
   ```

5. **Start Ollama & Pull Model**:
   ```powershell
   ollama pull mistral
   ```

---

### Running the Application

#### Option 1: One-Click Windows Launcher (Recommended)
Double-click or run from Command Prompt/PowerShell:
```bat
run.bat
```
This script automatically validates python/node environments, installs missing dependencies, launches the Flask backend (`server/main.py`), and starts the React frontend.

#### Option 2: Manual Start
- **Terminal 1 (Backend)**:
  ```powershell
  python server/main.py
  ```
  *(Runs on `http://127.0.0.1:5000`)*

- **Terminal 2 (Frontend)**:
  ```powershell
  npm start
  ```
  *(Runs on `http://localhost:3000`)*

---

## 📦 Local FLUX Model Setup (Optional)

To enable offline high-resolution image generation with `FLUX.1-schnell`:
1. Accept model terms on [Hugging Face FLUX.1-schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell).
2. Set your `HF_TOKEN` in `.env`.
3. Run the model downloader:
   ```bat
   download_model.bat
   ```
*(Requires ~23 GB disk space).*

---

## ❓ Troubleshooting

- **Ollama Connection Error**: Ensure the Ollama background service is active and `ollama pull mistral` has completed.
- **PowerShell Script Execution Policy**: Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` if venv activation is blocked.
- **CUDA / Out of Memory**: The system gracefully falls back to CPU or Hugging Face Inference API if CUDA GPU memory is insufficient.

---

## 📄 License & Citation
Refer to academic publications cited in the SRS/SDD documentation for model baseline details (ArcFace, StackGAN++, Text-Guided Sketch-to-Photo).
