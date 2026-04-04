// src/AttributeScreen.js
// ═══════════════════════════════════════════════════════════════════════════════
//  FACE TRACE - ATTRIBUTE REFINEMENT MODULE (INPAINTING)
//  "Paint the truth. Expose the details."
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import backIcon from "./assets/back.png";
import logoutIcon from "./assets/logout.png";

function AttributeScreen() {
  const navigate = useNavigate();

  // --- Core State ---
  const [features, setFeatures] = useState({});
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // --- Inpainting State ---
  const [inpaintPrompt, setInpaintPrompt] = useState("");
  const [isInpainting, setIsInpainting] = useState(false);
  const [inpaintStatus, setInpaintStatus] = useState("");
  const [brushSize, setBrushSize] = useState(28);
  const [isEraser, setIsEraser] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [inpaintMode, setInpaintMode] = useState(false); // toggle paint mode

  // --- Refs ---
  const imageRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const isPainting = useRef(false);
  const lastPos = useRef(null);

  // --- Logging ---
  const logUserActivity = useCallback(async (type, action, meta = {}) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      await addDoc(collection(db, "user_activity"), {
        uid: user.uid,
        email: user.email,
        type,
        action,
        meta,
        screen: "ATTRIBUTE",
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Attribute activity log failed:", err);
    }
  }, []);

  // --- Load data from localStorage ---
  useEffect(() => {
    setIsLoaded(true);
    logUserActivity("PAGE", "ATTRIBUTE_VIEW");

    const img = localStorage.getItem("generatedSketch");
    if (img) setGeneratedImage(`data:image/png;base64,${img}`);

    const stored = localStorage.getItem("extractedFeatures");
    if (stored) {
      try {
        setFeatures(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse features:", e);
      }
    }
  }, [logUserActivity]);

  // --- Drawing Helpers ---
  const getCanvasPos = (e) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const drawStroke = (pos) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    ctx.fillStyle = "rgba(255, 80, 80, 0.7)";
    ctx.strokeStyle = "rgba(255, 80, 80, 0.7)";
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    lastPos.current = pos;
    setHasMask(true);
  };

  const handleMouseDown = (e) => {
    if (!inpaintMode) return;
    isPainting.current = true;
    lastPos.current = null;
    drawStroke(getCanvasPos(e));
  };

  const handleMouseMove = (e) => {
    if (!isPainting.current || !inpaintMode) return;
    drawStroke(getCanvasPos(e));
  };

  const handleMouseUp = () => {
    isPainting.current = false;
    lastPos.current = null;
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  };

  // --- Extract the mask as a pure black/white PNG for the API ---
  const getMaskBase64 = () => {
    const srcCanvas = maskCanvasRef.current;
    if (!srcCanvas) return null;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = srcCanvas.width;
    outCanvas.height = srcCanvas.height;
    const ctx = outCanvas.getContext("2d");

    // Fill black (preserve area)
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

    // Copy over painted areas as white (inpaint area)
    const srcCtx = srcCanvas.getContext("2d");
    const imageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const outData = ctx.getImageData(0, 0, outCanvas.width, outCanvas.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] > 20) {
        // if painted (alpha > threshold)
        outData.data[i] = 255;
        outData.data[i + 1] = 255;
        outData.data[i + 2] = 255;
        outData.data[i + 3] = 255;
      }
    }
    ctx.putImageData(outData, 0, 0);
    return outCanvas.toDataURL("image/png");
  };

  // --- Main Inpainting Call ---
  const handleApplyInpaint = async () => {
    if (!inpaintPrompt.trim()) {
      setInpaintStatus("⚠️ Please describe what to change in the painted area.");
      return;
    }
    if (!hasMask) {
      setInpaintStatus("⚠️ Please paint over the area you want to modify first.");
      return;
    }

    setIsInpainting(true);
    setInpaintStatus("🎨 Sending to inpainting model...");
    logUserActivity("AI", "INPAINT_START", { prompt: inpaintPrompt });

    const currentImage = localStorage.getItem("generatedSketch");
    const maskBase64 = getMaskBase64();

    try {
      const response = await fetch("http://127.0.0.1:5000/api/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: currentImage,
          mask: maskBase64,
          prompt: inpaintPrompt,
        }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("generatedSketch", data.image);
        setGeneratedImage(`data:image/png;base64,${data.image}`);
        clearMask();
        setInpaintPrompt("");
        setInpaintMode(false);
        setInpaintStatus("✅ Inpainting applied successfully!");
        logUserActivity("AI", "INPAINT_SUCCESS");
        setTimeout(() => setInpaintStatus(""), 3000);
      } else {
        setInpaintStatus(`❌ ${data.error}`);
        logUserActivity("AI", "INPAINT_FAIL", { error: data.error });
      }
    } catch (err) {
      console.error(err);
      setInpaintStatus("❌ Network error. Is the backend running?");
    } finally {
      setIsInpainting(false);
    }
  };

  // --- Generate Hi-Res (sends to SuspectSketch for final review) ---
  const handleGenerateHiRes = async () => {
    setIsInpainting(true);
    setInpaintStatus("🚀 Finalizing sketch...");
    logUserActivity("AI", "GENERATE_HI_RES_START");

    // Simply navigate with the current sketch — no additional generation needed
    localStorage.setItem("lastPrompt", Object.entries(features || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(", "));

    setTimeout(() => {
      setIsInpainting(false);
      navigate("/suspect-sketch");
    }, 600);
  };

  const handleLogout = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        localStorage.removeItem(`ft_cached_descriptions_${user.uid}`);
        localStorage.removeItem(`ft_current_description_${user.uid}`);
      }
      await auth.signOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // --- Sync canvas size when image loads ---
  const handleImageLoad = () => {
    const img = imageRef.current;
    const canvas = maskCanvasRef.current;
    if (img && canvas) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }
  };

  return (
    <div className="attr-container">
      {/* ═══ NAV ═══ */}
      <nav className="attr-nav">
        <div className="attr-nav-left">
          <button
            className="attr-back-btn"
            onClick={() => {
              logUserActivity("NAVIGATION", "BACK_FROM_ATTRIBUTE");
              navigate(-1);
            }}
          >
            <img src={backIcon} alt="Back" className="attr-icon" />
            <span>Back</span>
          </button>
          <div className="attr-nav-title">
            <span className="attr-nav-label">SKETCH EDITOR</span>
            <span className="attr-nav-sub">Inpainting Studio</span>
          </div>
        </div>
        <div className="attr-nav-right">
          <button className="attr-btn-logout" onClick={handleLogout}>
            <img src={logoutIcon} alt="Logout" className="attr-icon" />
          </button>
        </div>
      </nav>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div className={`attr-main ${isLoaded ? "loaded" : ""}`}>
        {/* LEFT PANEL: Feature Summary */}
        <aside className="attr-sidebar">
          <div className="attr-panel">
            <div className="attr-panel-header">
              <span className="attr-panel-badge">FR-01</span>
              <h3>Extracted Features</h3>
            </div>
            <div className="attr-features-list">
              {Object.keys(features).length > 0 ? (
                Object.entries(features).map(([key, value]) => (
                  <div
                    key={key}
                    className="attr-feature-row"
                    onClick={() => setInpaintPrompt(value)}
                    title="Click to use as prompt"
                  >
                    <span className="attr-feature-key">{key}</span>
                    <span className="attr-feature-value">{value}</span>
                  </div>
                ))
              ) : (
                <p className="attr-features-empty">No features extracted.</p>
              )}
            </div>
            <p className="attr-tip">💡 Click a feature to use it as your inpaint prompt</p>
          </div>
        </aside>

        {/* CENTER: Canvas + Controls */}
        <main className="attr-center">
          {/* Sketch with paint canvas overlay */}
          <div className="attr-panel attr-canvas-panel">
            <div className="attr-panel-header">
              <span className="attr-panel-badge">FR-02</span>
              <h3>Suspect Sketch</h3>
              <div className="attr-canvas-tools">
                <button
                  className={`attr-tool-btn ${inpaintMode ? "active" : ""}`}
                  onClick={() => setInpaintMode(!inpaintMode)}
                  title={inpaintMode ? "Exit Paint Mode" : "Enter Paint Mode"}
                >
                  {inpaintMode ? "🖌️ Painting ON" : "🖌️ Paint Mode"}
                </button>
                {inpaintMode && (
                  <>
                    <button
                      className={`attr-tool-btn ${isEraser ? "active" : ""}`}
                      onClick={() => setIsEraser(!isEraser)}
                      title="Toggle Eraser"
                    >
                      {isEraser ? "✏️ Brush" : "🗑️ Eraser"}
                    </button>
                    <input
                      type="range"
                      min="8"
                      max="80"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="attr-brush-slider"
                      title="Brush Size"
                    />
                    <button
                      className="attr-tool-btn danger"
                      onClick={clearMask}
                      title="Clear Mask"
                    >
                      Clear Mask
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="attr-sketch-wrapper">
              {generatedImage ? (
                <>
                  <img
                    ref={imageRef}
                    src={generatedImage}
                    alt="Generated Suspect Sketch"
                    className="attr-sketch-img"
                    onLoad={handleImageLoad}
                    draggable={false}
                  />
                  <canvas
                    ref={maskCanvasRef}
                    className={`attr-mask-canvas ${inpaintMode ? "active" : ""}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                  />
                </>
              ) : (
                <div className="attr-no-image">
                  <span>No sketch generated yet.</span>
                  <button className="attr-btn secondary" onClick={() => navigate("/")}>
                    ← Generate Sketch
                  </button>
                </div>
              )}
            </div>

            {inpaintMode && (
              <div className="attr-paint-hint">
                <span>🖌️ Paint over the area you want to change, then describe it below.</span>
              </div>
            )}
          </div>

          {/* Inpainting Prompt + Actions */}
          <div className="attr-panel attr-prompt-panel">
            <div className="attr-panel-header">
              <span className="attr-panel-badge">FR-03</span>
              <h3>Describe the Change</h3>
            </div>
            <div className="attr-prompt-area">
              <textarea
                className="attr-prompt-input"
                value={inpaintPrompt}
                onChange={(e) => setInpaintPrompt(e.target.value)}
                placeholder={
                  inpaintMode
                    ? "e.g. short curly dark hair, wavy texture at the sides..."
                    : "Enable Paint Mode above, then paint the area you want to change and describe it here..."
                }
                rows={3}
                disabled={!inpaintMode}
              />
              <div className="attr-action-row">
                <button
                  className="attr-btn primary"
                  onClick={handleApplyInpaint}
                  disabled={isInpainting || !inpaintMode || !inpaintPrompt.trim() || !hasMask}
                >
                  {isInpainting ? "Applying..." : "✦ Apply Inpaint"}
                </button>
                <button
                  className="attr-btn secondary"
                  onClick={handleGenerateHiRes}
                  disabled={isInpainting || !generatedImage}
                >
                  Finalize →
                </button>
              </div>
              {inpaintStatus && (
                <p className="attr-status">{inpaintStatus}</p>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ═══ OVERLAY LOADER ═══ */}
      {isInpainting && (
        <div className="attr-overlay">
          <div className="attr-loader-box">
            <div className="attr-spinner" />
            <p>{inpaintStatus || "Processing..."}</p>
          </div>
        </div>
      )}

      <style>{`
        /* ═══════════════════════════════════
           ATTR SCREEN DESIGN SYSTEM
        ═══════════════════════════════════ */
        :root {
          --parchment: #F5F0E1;
          --ink: #1a1a2e;
          --ink-light: #2d2d44;
          --ink-muted: #4a4a5e;
          --cinnabar: #B33A3A;
          --cinnabar-dark: #8B2323;
          --indigo: #264653;
          --sunflower: #E9C46A;
          --success: #2A9D8F;
          --mask-red: rgba(255, 80, 80, 0.55);
          --radius-sm: 4px;
          --radius-md: 8px;
          --shadow: 3px 3px 0 var(--ink);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .attr-container {
          min-height: 100vh;
          background: var(--parchment);
          background-image:
            radial-gradient(ellipse at 15% 45%, rgba(38,70,83,0.04) 0%, transparent 60%),
            radial-gradient(ellipse at 85% 20%, rgba(179,58,58,0.04) 0%, transparent 50%);
          font-family: 'Inter', -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ── NAV ── */
        .attr-nav {
          position: fixed; top: 0; left: 0; right: 0;
          height: 56px;
          background: var(--parchment);
          border-bottom: 1.5px solid rgba(26, 26, 46, 0.12);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.5rem;
          z-index: 100;
          backdrop-filter: blur(8px);
        }

        .attr-nav-left { display: flex; align-items: center; gap: 1rem; }
        .attr-nav-right { display: flex; align-items: center; gap: 0.5rem; }

        .attr-back-btn {
          display: flex; align-items: center; gap: 0.4rem;
          background: none; border: 1.5px solid rgba(26,26,46,0.18);
          border-radius: var(--radius-sm);
          color: var(--ink); cursor: pointer;
          padding: 0.35rem 0.8rem;
          font-size: 0.78rem; font-weight: 600;
          transition: all 0.2s;
        }
        .attr-back-btn:hover { background: rgba(26,26,46,0.06); }

        .attr-nav-title { display: flex; flex-direction: column; gap: 0.05rem; }
        .attr-nav-label {
          font-size: 0.6rem; font-weight: 800;
          letter-spacing: 0.18em;
          color: var(--ink); opacity: 0.35;
        }
        .attr-nav-sub {
          font-size: 0.82rem; font-weight: 700;
          color: var(--ink);
        }

        .attr-btn-logout {
          background: none; border: none; cursor: pointer;
          padding: 0.4rem; border-radius: var(--radius-sm);
          opacity: 0.5; transition: all 0.2s;
        }
        .attr-btn-logout:hover { opacity: 1; background: rgba(179,58,58,0.1); }

        .attr-icon {
          width: 18px; height: 18px;
          object-fit: contain;
          filter: brightness(0) saturate(100%);
        }

        /* ── MAIN LAYOUT ── */
        .attr-main {
          display: flex;
          gap: 1.25rem;
          padding: 5rem 1.5rem 2rem;
          flex: 1;
          opacity: 0; transform: translateY(10px);
          transition: all 0.4s ease;
        }
        .attr-main.loaded { opacity: 1; transform: translateY(0); }

        /* ── SIDEBAR ── */
        .attr-sidebar {
          width: 260px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* ── CENTER ── */
        .attr-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 0;
        }

        /* ── PANEL ── */
        .attr-panel {
          background: white;
          border: 2px solid var(--ink);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .attr-panel-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-bottom: 1.5px solid rgba(26,26,46,0.1);
          background: rgba(26,26,46,0.02);
          flex-wrap: wrap;
        }

        .attr-panel-badge {
          background: var(--ink);
          color: var(--parchment);
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          padding: 0.2rem 0.5rem;
          border-radius: 2px;
        }

        .attr-panel-header h3 {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--ink);
          flex: 1;
        }

        /* ── FEATURES LIST ── */
        .attr-features-list {
          overflow-y: auto;
          max-height: 380px;
          padding: 0.5rem;
        }

        .attr-feature-row {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.5rem 0.6rem;
          border-radius: var(--radius-sm);
          border-bottom: 1px solid rgba(26,26,46,0.06);
          cursor: pointer;
          transition: background 0.18s;
        }
        .attr-feature-row:hover { background: rgba(26,26,46,0.04); }

        .attr-feature-key {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--cinnabar);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .attr-feature-value {
          font-size: 0.8rem;
          color: var(--ink-muted);
          line-height: 1.35;
        }

        .attr-features-empty {
          font-size: 0.8rem; color: var(--ink-muted);
          text-align: center; padding: 2rem 1rem; opacity: 0.6;
        }

        .attr-tip {
          font-size: 0.68rem; color: var(--ink-muted);
          padding: 0.6rem 0.75rem;
          border-top: 1px dashed rgba(26,26,46,0.12);
          opacity: 0.7;
        }

        /* ── CANVAS PANEL ── */
        .attr-canvas-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .attr-canvas-tools {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-left: auto;
          flex-wrap: wrap;
        }

        .attr-tool-btn {
          padding: 0.3rem 0.7rem;
          font-size: 0.72rem;
          font-weight: 600;
          background: transparent;
          border: 1.5px solid rgba(26,26,46,0.25);
          border-radius: var(--radius-sm);
          color: var(--ink);
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .attr-tool-btn:hover { background: rgba(26,26,46,0.06); }
        .attr-tool-btn.active {
          background: var(--cinnabar);
          border-color: var(--cinnabar-dark);
          color: white;
        }
        .attr-tool-btn.danger { border-color: rgba(179,58,58,0.4); color: var(--cinnabar); }
        .attr-tool-btn.danger:hover { background: rgba(179,58,58,0.1); }

        .attr-brush-slider {
          width: 90px;
          accent-color: var(--cinnabar);
          cursor: pointer;
        }

        .attr-sketch-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: rgba(26,26,46,0.02);
          min-height: 320px;
        }

        .attr-sketch-img {
          max-width: 100%;
          max-height: 480px;
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
          border-radius: 2px;
          user-select: none;
        }

        .attr-mask-canvas {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: 480px;
          cursor: crosshair;
          opacity: 0;
          pointer-events: none;
          border-radius: 2px;
          transition: opacity 0.2s;
          display: block;
        }
        .attr-mask-canvas.active {
          opacity: 1;
          pointer-events: all;
        }

        .attr-no-image {
          display: flex; flex-direction: column;
          align-items: center; gap: 1rem;
          color: var(--ink-muted); font-size: 0.9rem;
          padding: 3rem;
        }

        .attr-paint-hint {
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          color: var(--cinnabar);
          background: rgba(179,58,58,0.06);
          border-top: 1px solid rgba(179,58,58,0.15);
          font-weight: 600;
        }

        /* ── PROMPT PANEL ── */
        .attr-prompt-panel {}

        .attr-prompt-area {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .attr-prompt-input {
          width: 100%;
          border: 1.5px solid rgba(26,26,46,0.2);
          border-radius: var(--radius-sm);
          padding: 0.75rem;
          font-family: inherit;
          font-size: 0.85rem;
          color: var(--ink);
          background: white;
          resize: vertical;
          transition: border-color 0.2s;
          outline: none;
        }
        .attr-prompt-input:focus { border-color: var(--cinnabar); }
        .attr-prompt-input:disabled { background: rgba(26,26,46,0.04); color: var(--ink-muted); cursor: not-allowed; }

        .attr-action-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .attr-btn {
          padding: 0.6rem 1.4rem;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid var(--ink);
          font-family: inherit;
        }
        .attr-btn.primary {
          background: var(--ink);
          color: var(--parchment);
          box-shadow: 2px 2px 0 rgba(0,0,0,0.4);
        }
        .attr-btn.primary:hover:not(:disabled) {
          background: var(--cinnabar);
          border-color: var(--cinnabar-dark);
          transform: translateY(-1px);
        }
        .attr-btn.secondary {
          background: transparent;
          color: var(--ink);
        }
        .attr-btn.secondary:hover:not(:disabled) { background: rgba(26,26,46,0.07); }
        .attr-btn:disabled {
          opacity: 0.4; cursor: not-allowed;
          transform: none; box-shadow: none;
        }

        .attr-status {
          font-size: 0.82rem;
          color: var(--ink-muted);
          padding: 0.4rem 0;
          min-height: 1.5rem;
        }

        /* ── OVERLAY LOADER ── */
        .attr-overlay {
          position: fixed; inset: 0;
          background: rgba(26,26,46,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          backdrop-filter: blur(4px);
        }

        .attr-loader-box {
          background: white;
          border: 2px solid var(--ink);
          box-shadow: 5px 5px 0 var(--ink);
          border-radius: var(--radius-md);
          padding: 2.5rem 3rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
        }

        .attr-spinner {
          width: 44px; height: 44px;
          border: 3px solid rgba(26,26,46,0.12);
          border-top-color: var(--cinnabar);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .attr-loader-box p {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--ink);
          max-width: 240px;
          text-align: center;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .attr-main { flex-direction: column; }
          .attr-sidebar { width: 100%; }
        }
      `}</style>
    </div>
  );
}

export default AttributeScreen;