// src/SuspectSketch.js
// ═══════════════════════════════════════════════════════════════════════════════
//  FACE TRACE - SUSPECT SKETCH REFINEMENT MODULE
//  "Every stroke reveals the truth hidden in shadow."
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { auth, db } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// Import icon assets
import micIcon from "./assets/mic.png";
import sendIcon from "./assets/send.png";
import downloadIcon from "./assets/download.png";
import saveIcon from "./assets/save.png";
import closeIcon from "./assets/close.png";
import backIcon from "./assets/back.png";
import undoIcon from "./assets/undo.png";
import redoIcon from "./assets/redo.png";
import resetIcon from "./assets/reset.png";
import zoomInIcon from "./assets/zoomin.png";
import zoomOutIcon from "./assets/zoomout.png";
import logoutIcon from "./assets/logout.png";

export default function SuspectSketch() {
  const logUserActivity = useCallback(async (type, action, meta = {}) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await addDoc(collection(db, "user_activity"), {
        uid: user.uid,
        email: user.email,
        sessionId: sessionId.current,
        type,
        action,
        meta,
        screen: "SUSPECT_SKETCH",
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Sketch activity log failed:", err);
    }
  }, []);

  const [command, setCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState([
    {
      text: "Initial sketch generated from witness description",
      type: "system",
      time: "00:00",
    },
  ]);
  const [isListening, setIsListening] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sketchVersion, setSketchVersion] = useState(1);
  const [isMatching, setIsMatching] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const navigate = useNavigate();
  const sketchRef = useRef();
  const historyEndRef = useRef();
  const sessionId = useRef(
    crypto.randomUUID?.() ||
    Date.now().toString() + Math.random().toString(36)
  );

  useEffect(() => {
    setIsLoaded(true);
    logUserActivity("PAGE", "SUSPECT_SKETCH_VIEW");

    const img = localStorage.getItem("generatedSketch");
    if (img) setGeneratedImage(`data:image/png;base64,${img}`);

    const prompt = localStorage.getItem("lastPrompt");
    if (prompt) setCurrentPrompt(prompt);
  }, [logUserActivity]);

  // Auto-scroll to bottom of history
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commandHistory]);

  // Get current time string
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  // Voice recognition setup
  const handleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setCommandHistory((prev) => [
        ...prev,
        {
          text: "Voice recognition not supported in this browser",
          type: "error",
          time: getCurrentTime(),
        },
      ]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    logUserActivity("VOICE", "COMMAND_START");
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;

      logUserActivity("VOICE", "COMMAND_RESULT", {
        transcript,
      });

      setCommand(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setCommandHistory((prev) => [
        ...prev,
        {
          text: `Voice error: ${event.error}`,
          type: "error",
          time: getCurrentTime(),
        },
      ]);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  // Stop listening
  const stopListening = () => {
    setIsListening(false);
  };

  // Send command
  const handleSendCommand = async () => {
    if (!command.trim() || isProcessing) return;

    logUserActivity("COMMAND", "USER_COMMAND", {
      command,
    });

    setIsProcessing(true);
    setCommandHistory((prev) => [
      ...prev,
      {
        text: command,
        type: "user",
        time: getCurrentTime(),
      },
    ]);

    try {
      const response = await fetch("http://127.0.0.1:5000/api/refine-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: generatedImage,
          original_prompt: currentPrompt,
          command: command,
          strength: 0.45,
        }),
      });

      const data = await response.json();
      if (data.success) {
        logUserActivity("AI", "SKETCH_MODIFIED", {
          version: sketchVersion + 1,
          command,
          prompt: data.prompt
        });

        setGeneratedImage(`data:image/png;base64,${data.image}`);
        setCurrentPrompt(data.prompt);
        setSketchVersion((prev) => prev + 1);

        setCommandHistory((prev) => [
          ...prev,
          {
            text: `Applied modification: "${command}"`,
            type: "system",
            time: getCurrentTime(),
          },
        ]);

        // Persist the refined version
        localStorage.setItem("generatedSketch", data.image);
        localStorage.setItem("lastPrompt", data.prompt);
      } else {
        throw new Error(data.error || "Refinement failed");
      }
    } catch (err) {
      console.error("Refinement error:", err);
      setCommandHistory((prev) => [
        ...prev,
        {
          text: `ERROR: ${err.message}`,
          type: "error",
          time: getCurrentTime(),
        },
      ]);
    } finally {
      setCommand("");
      setIsProcessing(false);
    }
  };

  // Export function
  const handleExport = async (format) => {
    logUserActivity("EXPORT", "SKETCH_EXPORT", {
      format,
      version: sketchVersion,
    });

    if (format === "pdf") {
      try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // 1. Header (Dark ink style)
        doc.setFillColor(26, 26, 46); // Ink color
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("FORENSIC INVESTIGATION PORTRAIT", 20, 25);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("OFFICIAL RECORD - CONFIDENTIAL", 20, 32);

        // 2. Metadata Box
        doc.setTextColor(26, 26, 46);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("CASE INFORMATION", 20, 55);

        doc.setDrawColor(200, 200, 200);
        doc.line(20, 57, 190, 57);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`DATE: ${new Date().toLocaleDateString()}`, 20, 65);
        doc.text(`TIME: ${new Date().toLocaleTimeString()}`, 20, 71);
        doc.text(`VERSION: ${sketchVersion.toString().padStart(2, '0')}`, 120, 65);
        doc.text(`SESSION ID: ${sessionId.current.substring(0, 12).toUpperCase()}`, 120, 71);

        // 3. The Portrait
        if (generatedImage) {
          doc.setDrawColor(26, 26, 46);
          doc.setLineWidth(1);
          // Frame for centered image
          const imgSize = 130;
          const imgX = (pageWidth - imgSize) / 2;
          doc.rect(imgX - 5, 85, imgSize + 10, imgSize + 10);

          doc.addImage(generatedImage, 'PNG', imgX, 90, imgSize, imgSize);
        }

        // 4. Description Box
        doc.setFillColor(245, 240, 225); // Parchment color
        doc.rect(20, 235, 170, 35, 'F');
        doc.setDrawColor(26, 26, 46);
        doc.rect(20, 235, 170, 35, 'D');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("REFINED WITNESS DESCRIPTION & ATTRIBUTES:", 25, 242);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        const splitPrompt = doc.splitTextToSize(currentPrompt || "Initial forensic generation", 160);
        doc.text(splitPrompt, 25, 248);

        // 5. Footer stamp
        doc.setFont("helvetica", "bold");
        doc.setTextColor(179, 58, 58); // Cinnabar Red
        doc.text("VERIFIED DRAFT", 160, 285);

        doc.save(`Forensic_Report_Case_${sessionId.current.substring(0, 6).toUpperCase()}.pdf`);
        setShowExportOptions(false);

        setCommandHistory((prev) => [
          ...prev,
          {
            text: `Professional PDF Report generated successfully.`,
            type: "system",
            time: getCurrentTime(),
          },
        ]);
        return;
      } catch (err) {
        console.error("PDF Export failed:", err);
        alert("PDF Generation failed. Try PNG export.");
      }
    }

    // Capture the "artistic" viewport for image formats
    const canvas = await html2canvas(sketchRef.current, {
      backgroundColor: "#F5F0E1",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL("image/png");

    if (format === "png") {
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `suspect_sketch_v${sketchVersion}.png`;
      link.click();
    } else if (format === "jpg") {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/jpeg", 0.9);
      link.download = `suspect_sketch_v${sketchVersion}.jpg`;
      link.click();
    }

    setShowExportOptions(false);
    setCommandHistory((prev) => [
      ...prev,
      {
        text: `Exported sketch as ${format.toUpperCase()}`,
        type: "system",
        time: getCurrentTime(),
      },
    ]);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendCommand();
    }
  };

  // Zoom controls
  const handleZoom = (delta) => {
    setZoomLevel((prev) => {
      const next = Math.min(150, Math.max(50, prev + delta));
      logUserActivity("UI", "ZOOM", { zoom: next });
      return next;
    });
  };

  const handleMatchDatabase = async () => {
    try {
      setIsMatching(true);

      await logUserActivity("RECOGNITION", "MATCH_BUTTON_CLICKED", {
        version: sketchVersion,
      });

      await logUserActivity("RECOGNITION", "MATCH_STARTED", {
        version: sketchVersion,
      });

      const canvas = await html2canvas(sketchRef.current, {
        backgroundColor: "#F5F0E1",
        scale: 2,
      });

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );

      const formData = new FormData();
      formData.append("image", blob, "sketch.jpg");

      const response = await fetch("http://127.0.0.1:5000/api/verify", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Recognition failed");
      }

      await logUserActivity("RECOGNITION", "MATCH_SUCCESS", {
        similarity: data.similarity,
        label: data.label,
        verified: data.verified,
      });

      // setMatchResult(data); (Removed as redundant)

      await logUserActivity("NAVIGATION", "GO_TO_PATTERN_MATCHING", {
        similarity: data.similarity,
        label: data.label,
      });

      navigate("/pattern-matching", {
        state: { matchResult: data },
      });
    } catch (err) {
      console.error("Recognition error:", err);

      await logUserActivity("RECOGNITION", "MATCH_FAILED", {
        error: err.message,
      });
    } finally {
      setIsMatching(false);
    }
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

  // Quick commands
  const quickCommands = [
    "Widen the jaw",
    "Make nose thinner",
    "Add facial hair",
    "Make eyes larger",
    "Add wrinkles",
    "Darken eyebrows",
  ];

  return (
    <div className="sketch-container">
      {/* Background Effects */}
      <div className="bg-effects">
        <div className="paper-texture" />
        <div className="scan-lines" />

        {/* Corner Brackets */}
        <div className="corner-bracket top-left">
          <svg viewBox="0 0 50 50">
            <path
              d="M0 25 L0 0 L25 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="corner-bracket top-right">
          <svg viewBox="0 0 50 50">
            <path
              d="M25 0 L50 0 L50 25"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="corner-bracket bottom-left">
          <svg viewBox="0 0 50 50">
            <path
              d="M0 25 L0 50 L25 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="corner-bracket bottom-right">
          <svg viewBox="0 0 50 50">
            <path
              d="M25 50 L50 50 L50 25"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Ink Splatters */}
        <svg className="ink-splatter top" viewBox="0 0 100 100">
          <circle
            cx="15"
            cy="20"
            r="12"
            fill="var(--cinnabar)"
            opacity="0.06"
          />
          <circle
            cx="30"
            cy="12"
            r="6"
            fill="var(--cinnabar)"
            opacity="0.04"
          />
        </svg>
        <svg className="ink-splatter bottom" viewBox="0 0 100 100">
          <circle
            cx="85"
            cy="80"
            r="14"
            fill="var(--indigo)"
            opacity="0.05"
          />
          <circle
            cx="70"
            cy="88"
            r="7"
            fill="var(--indigo)"
            opacity="0.04"
          />
        </svg>
      </div>

      {/* ═══ NAVIGATION ═══ */}
      <nav className="top-nav">
        <div className="nav-left-group">
          <button
            className="nav-back-btn"
            onClick={() => {
              logUserActivity("NAVIGATION", "BACK_FROM_SKETCH");
              navigate(-1);
            }}
          >
            <img src={backIcon} alt="Back" className="crisp-icon" />
            <span>Back</span>
          </button>
          <span className="nav-sep" />
          <div className="nav-titles">
            <span className="nav-accent">REFINEMENT MODULE</span>
            <span className="nav-page-label">SKETCH EDITOR</span>
          </div>
        </div>
        <div className="nav-right-group">
          <div className="version-badge-nav">
            <span className="version-label-nav">v</span>
            <span className="version-number-nav">
              {sketchVersion.toString().padStart(2, "0")}
            </span>
          </div>
          <span className="nav-dot" />
          <div className="status-indicator-nav">
            <span
              className={`status-dot-nav ${isProcessing ? "processing" : "ready"}`}
            />
            <span className="status-text-nav">
              {isProcessing ? "PROCESSING" : "READY"}
            </span>
          </div>
          <span className="nav-dot" />
          <div className="hanko-stamp nav-stamp">
            <span>DRAFT</span>
          </div>
          <span className="nav-dot" />
          <button
            className="nav-btn nav-btn-logout"
            onClick={handleLogout}
            title="Logout"
          >
            <img src={logoutIcon} alt="Logout" className="crisp-icon" />
            <span className="nav-btn-label">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={`main-content ${isLoaded ? "loaded" : ""}`}>
        {/* Main Grid */}
        <div className="content-grid">
          {/* Sketch Panel */}
          <section className="panel sketch-panel">
            <div className="panel-frame">
              <div className="panel-header">
                <div className="panel-title-group">
                  <span className="panel-number">01</span>
                  <h2>Generated Portrait</h2>
                </div>
                <div className="hanko-seal">
                  <div className="seal-inner">
                    <span>DRAFT</span>
                  </div>
                </div>
              </div>

              <div className="sketch-viewport">
                <div
                  className="sketch-canvas"
                  ref={sketchRef}
                  style={{ transform: `scale(${zoomLevel / 100})` }}
                >
                  {/* Sketch Frame */}
                  <div className="sketch-frame">
                    <div className="frame-corners">
                      <span className="fc tl" />
                      <span className="fc tr" />
                      <span className="fc bl" />
                      <span className="fc br" />
                    </div>

                    <img
                      src={generatedImage || ""}
                      alt="Suspect Sketch"
                      className={`sketch-image ${!generatedImage ? 'placeholder' : ''}`}
                    />

                    {/* Brush stroke overlay */}
                    <div className="brush-overlay" />
                  </div>

                  {/* Processing Overlay */}
                  {isProcessing && (
                    <div className="processing-overlay">
                      <div className="processing-content">
                        <div className="processing-rings">
                          <div className="ring ring-1" />
                          <div className="ring ring-2" />
                          <div className="ring ring-3" />
                        </div>
                        <span className="processing-text">
                          REFINING FEATURES
                        </span>
                        <div className="processing-dots">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Zoom indicator */}
                <div className="zoom-indicator">
                  <span>{zoomLevel}%</span>
                </div>
              </div>

              {/* Sketch Controls */}
              <div className="sketch-controls">
                <div className="control-group">
                  <button className="control-btn" title="Undo">
                    <img
                      src={undoIcon}
                      alt="Undo"
                      className="crisp-icon"
                    />
                  </button>
                  <button className="control-btn" title="Redo">
                    <img
                      src={redoIcon}
                      alt="Redo"
                      className="crisp-icon"
                    />
                  </button>
                  <button className="control-btn" title="Reset">
                    <img
                      src={resetIcon}
                      alt="Reset"
                      className="crisp-icon"
                    />
                  </button>
                </div>

                <div className="control-divider" />

                <div className="control-group zoom-controls">
                  <button
                    className="control-btn"
                    onClick={() => handleZoom(-10)}
                    title="Zoom Out"
                  >
                    <img
                      src={zoomOutIcon}
                      alt="Zoom Out"
                      className="crisp-icon"
                    />
                  </button>
                  <button
                    className="control-btn"
                    onClick={() => handleZoom(10)}
                    title="Zoom In"
                  >
                    <img
                      src={zoomInIcon}
                      alt="Zoom In"
                      className="crisp-icon"
                    />
                  </button>
                </div>

                <div className="control-divider" />

                <div className="control-group">
                  <button className="control-btn" title="Download">
                    <img
                      src={downloadIcon}
                      alt="Download"
                      className="crisp-icon"
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Command Panel */}
          <section className="panel command-panel">
            <div className="panel-frame">
              <div className="panel-header">
                <div className="panel-title-group">
                  <span className="panel-number">02</span>
                  <h2>Refinement Terminal</h2>
                </div>
                <div className="terminal-status">
                  <span className="terminal-dot" />
                  <span>ACTIVE</span>
                </div>
              </div>

              {/* Command History */}
              <div className="terminal-history">
                <div className="history-scroll">
                  {commandHistory.map((cmd, index) => (
                    <div
                      key={index}
                      className={`history-entry ${cmd.type}`}
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <div className="entry-marker">
                        {cmd.type === "user" && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        )}
                        {cmd.type === "system" && (
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                          </svg>
                        )}
                        {cmd.type === "error" && (
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                          </svg>
                        )}
                      </div>
                      <div className="entry-content">
                        <span className="entry-text">{cmd.text}</span>
                        <span className="entry-time">{cmd.time}</span>
                      </div>
                    </div>
                  ))}

                  {isProcessing && (
                    <div className="history-entry system processing-entry">
                      <div className="entry-marker">
                        <div className="processing-spinner-small" />
                      </div>
                      <div className="entry-content">
                        <span className="entry-text">
                          Processing modification...
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={historyEndRef} />
                </div>
              </div>

              {/* Voice Indicator */}
              {isListening && (
                <div className="voice-active-panel">
                  <div className="voice-visualizer">
                    <div className="visualizer-bars">
                      {[...Array(12)].map((_, i) => (
                        <span
                          key={i}
                          className="bar"
                          style={{ animationDelay: `${i * 0.05}s` }}
                        />
                      ))}
                    </div>
                    <div className="voice-info">
                      <span className="voice-status">LISTENING</span>
                      <span className="voice-hint">
                        Speak your modification command...
                      </span>
                    </div>
                  </div>
                  <button
                    className="stop-listening-btn"
                    onClick={stopListening}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    <span>STOP</span>
                  </button>
                </div>
              )}

              {/* Command Input */}
              <div className="command-input-area">
                <div className="input-row">
                  <div className="input-field-wrapper">
                    <span className="input-prefix">&gt;</span>
                    <input
                      type="text"
                      className="command-input"
                      placeholder="Enter modification command..."
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isProcessing || isListening}
                    />
                  </div>

                  <div className="input-actions">
                    {/* Microphone Button */}
                    <button
                      className={`mic-btn ${isListening ? "active" : ""}`}
                      onClick={isListening ? stopListening : handleVoiceInput}
                      disabled={isProcessing}
                      title={
                        isListening ? "Stop Listening" : "Voice Input"
                      }
                    >
                      <div className="mic-icon-wrapper">
                        {isListening ? (
                          <div className="mic-waves">
                            <span className="wave wave-1" />
                            <span className="wave wave-2" />
                            <span className="wave wave-3" />
                          </div>
                        ) : null}
                        <img
                          src={micIcon}
                          alt="Microphone"
                          className="crisp-icon inverted"
                        />
                      </div>
                      <span className="mic-label">
                        {isListening ? "LISTENING" : "VOICE"}
                      </span>
                    </button>

                    {/* Send Button */}
                    <button
                      className="send-btn"
                      onClick={handleSendCommand}
                      disabled={
                        !command.trim() || isProcessing || isListening
                      }
                    >
                      <img
                        src={sendIcon}
                        alt="Send"
                        className="crisp-icon inverted"
                      />
                      <span>SEND</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Commands */}
              <div className="quick-commands">
                <div className="quick-header">
                  <span className="quick-label">QUICK COMMANDS</span>
                  <div className="quick-line" />
                </div>
                <div className="quick-chips">
                  {quickCommands.map((cmd, i) => (
                    <button
                      key={i}
                      className="quick-chip"
                      onClick={() => setCommand(cmd)}
                      disabled={isProcessing || isListening}
                    >
                      <span>{cmd}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Action Bar */}
        <div className="action-bar">
          <button
            className={`action-btn primary ${isMatching ? "loading" : ""}`}
            onClick={handleMatchDatabase}
            disabled={isMatching || isProcessing}
          >
            <img src={saveIcon} alt="Match" className="crisp-icon inverted" />
            <span>{isMatching ? "SEARCHING..." : "MATCH DATABASE"}</span>
          </button>

          <button
            className="action-btn secondary"
            onClick={() => setShowExportOptions(true)}
          >
            <img
              src={saveIcon}
              alt="Save"
              className="crisp-icon inverted"
            />
            <span>FINALIZE & EXPORT</span>
          </button>

          <button
            className="action-btn tertiary"
            onClick={() => {
              logUserActivity("NAVIGATION", "GO_TO_ATTRIBUTES");
              navigate("/attributes");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <span>ATTRIBUTES</span>
          </button>
        </div>

        {/* ═══ IMMERSIVE OVERLAYS ═══ */}
        {(isMatching || isProcessing) && (
          <div className="immersive-loader-overlay">
            <div className="scan-line-v3" />
            <div className="loader-content-v2">
              <div className="loader-visual-v2">
                <div className="pulse-ring-v2" />
                <div className="pulse-ring-v2" />
                <div className="pulse-ring-v2" />
                <div className="central-icon-v2">
                  {isMatching ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="loader-svg">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="loader-svg">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  )}
                </div>
              </div>

              <div className="loader-text-v2">
                <span className="loader-status-v2">
                  {isMatching ? "DATABASE SEARCH" : "IMAGE REFINEMENT"}
                </span>
                <h2 className="loader-title-v2">
                  {isMatching ? "Analyzing Facial Patterns" : "Updating Suspect Portrait"}
                </h2>
                <div className="loader-progress-v2">
                  <div className="progress-fill-v2" />
                </div>
              </div>

              <p className="loader-hint-v2">
                {isMatching
                  ? "Comparing biometric markers against federal criminal databases. This may take a few moments..."
                  : "Recalculating forensic features based on witness feedback. Stabilizing neural layers..."}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="page-footer">
          <div className="footer-decoration">
            <div className="deco-line" />
            <div className="deco-emblem">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="deco-line" />
          </div>
          <p className="footer-text">
            SKETCH REFINEMENT MODULE v2.1 | SESSION ACTIVE
          </p>
        </footer>
      </main>

      {/* Export Modal */}
      {
        showExportOptions && (
          <div
            className="modal-overlay"
            onClick={() => setShowExportOptions(false)}
          >
            <div
              className="modal-container"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-frame">
                {/* Modal Header */}
                <div className="modal-header">
                  <div className="modal-title-group">
                    <div className="modal-hanko">
                      <span>SAVE</span>
                    </div>
                    <div className="modal-titles">
                      <span className="modal-tag">EXPORT OPTIONS</span>
                      <h2 className="modal-title">Save Sketch</h2>
                    </div>
                  </div>
                  <button
                    className="modal-close"
                    onClick={() => setShowExportOptions(false)}
                  >
                    <img
                      src={closeIcon}
                      alt="Close"
                      className="crisp-icon"
                    />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body">
                  <p className="modal-description">
                    Select your preferred export format for the generated
                    sketch.
                  </p>

                  <div className="export-grid">
                    <button
                      className="export-card"
                      onClick={() => handleExport("png")}
                    >
                      <div className="export-icon-box png">
                        <img
                          src={downloadIcon}
                          alt="PNG"
                          className="crisp-icon"
                        />
                      </div>
                      <div className="export-details">
                        <span className="export-format">PNG</span>
                        <span className="export-desc">
                          Lossless, transparent support
                        </span>
                      </div>
                      <div className="export-arrow">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>

                    <button
                      className="export-card"
                      onClick={() => handleExport("jpg")}
                    >
                      <div className="export-icon-box jpg">
                        <img
                          src={downloadIcon}
                          alt="JPG"
                          className="crisp-icon"
                        />
                      </div>
                      <div className="export-details">
                        <span className="export-format">JPG</span>
                        <span className="export-desc">
                          Compressed, smaller size
                        </span>
                      </div>
                      <div className="export-arrow">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>

                    <button
                      className="export-card"
                      onClick={() => handleExport("pdf")}
                    >
                      <div className="export-icon-box pdf">
                        <img
                          src={downloadIcon}
                          alt="PDF"
                          className="crisp-icon"
                        />
                      </div>
                      <div className="export-details">
                        <span className="export-format">PDF</span>
                        <span className="export-desc">
                          Document, print-ready
                        </span>
                      </div>
                      <div className="export-arrow">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer">
                  <button
                    className="modal-cancel"
                    onClick={() => setShowExportOptions(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      <style>{`
        /* ═══════════════════════════════════════
           FACE TRACE - SKETCH MODULE
           Neo-Edo Enhanced UI
        ═══════════════════════════════════════ */

        :root {
          --parchment: #F5F0E1;
          --parchment-light: #FAF8F3;
          --parchment-dark: #E8E0CC;
          --ink: #1a1a2e;
          --ink-light: #2d2d44;
          --ink-muted: #4a4a5e;
          --ink-faded: #6b6b7e;
          --cinnabar: #B33A3A;
          --cinnabar-dark: #8B2323;
          --cinnabar-light: #D64545;
          --indigo: #264653;
          --indigo-light: #2A9D8F;
          --sunflower: #E9C46A;
          --gold: #D4A84B;

          --font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

          --border-thick: 3px;
          --border-thin: 1.5px;
          --transition-snap: cubic-bezier(0.68, -0.55, 0.265, 1.55);
          --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
          --shadow-hard: 4px 4px 0 var(--ink);
          --shadow-soft: 0 4px 20px rgba(26, 26, 46, 0.1);
          --radius-sm: 3px;
          --radius-md: 6px;
        }

        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ═══════════════════════════════════════
           CRISP ICON FIX — UNIVERSAL
        ═══════════════════════════════════════ */
        .crisp-icon {
          width: 20px !important;
          height: 20px !important;
          object-fit: contain;
          image-rendering: -webkit-optimize-contrast;
          background: transparent !important;
          padding: 0 !important;
          border: none !important;
          display: block;
          flex-shrink: 0;
          -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 0a50 50 0 0 1 50 50a50 50 0 0 1-50 50a50 50 0 0 1-50-50a50 50 0 0 1 50-50' fill='black'/%3E%3C/svg%3E");
          -webkit-mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-position: center;
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 0a50 50 0 0 1 50 50a50 50 0 0 1-50 50a50 50 0 0 1-50-50a50 50 0 0 1 50-50' fill='black'/%3E%3C/svg%3E");
          mask-size: contain;
          mask-repeat: no-repeat;
          mask-position: center;
          transition: transform 0.2s var(--transition-smooth),
                      opacity 0.2s var(--transition-smooth);
        }

        .crisp-icon.inverted {
          filter: brightness(0) saturate(100%) invert(100%);
        }

        .crisp-icon.action-icon-dark {
          filter: brightness(0) saturate(100%);
          opacity: 0.85;
        }

        /* ═══════════════════════════════════════
           CONTAINER & BACKGROUND
        ═══════════════════════════════════════ */

        .sketch-container {
          min-height: 100vh;
          background: var(--parchment);
          background-image:
            radial-gradient(ellipse at 20% 50%, rgba(38, 70, 83, 0.03) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(179, 58, 58, 0.03) 0%, transparent 50%);
          position: relative;
          font-family: var(--font-main);
          color: var(--ink);
          overflow-x: hidden;
          padding-top: 5rem;
        }

        .bg-effects {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .paper-texture {
          position: absolute;
          inset: 0;
          opacity: 0.25;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
        }

        .scan-lines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.01) 2px,
            rgba(0, 0, 0, 0.01) 4px
          );
        }

        .corner-bracket {
          position: absolute;
          width: 40px;
          height: 40px;
          color: var(--ink);
          opacity: 0.15;
        }

        .corner-bracket.top-left { top: 1rem; left: 1rem; }
        .corner-bracket.top-right { top: 1rem; right: 1rem; }
        .corner-bracket.bottom-left { bottom: 1rem; left: 1rem; }
        .corner-bracket.bottom-right { bottom: 1rem; right: 1rem; }

        .ink-splatter {
          position: absolute;
          width: 150px;
          height: 150px;
        }

        .ink-splatter.top { top: 0; left: 50px; }
        .ink-splatter.bottom { bottom: 0; right: 50px; }

        /* ═══════════════════════════════════════
           NAVIGATION (Matching AttributeScreen)
        ═══════════════════════════════════════ */
        .top-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 56px;
          background: linear-gradient(180deg, var(--parchment) 0%, var(--parchment) 80%, transparent 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          z-index: 100;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .top-nav::after {
          content: '';
          position: absolute;
          bottom: 0; left: 2rem; right: 2rem;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--ink-muted) 15%,
            var(--ink) 40%,
            var(--ink) 60%,
            var(--ink-muted) 85%,
            transparent 100%
          );
          opacity: 0.15;
        }

        .nav-left-group { display: flex; align-items: center; gap: 0.85rem; }
        .nav-right-group { display: flex; align-items: center; gap: 0.6rem; }
        .nav-sep { width: 1px; height: 18px; background: var(--ink); opacity: 0.1; }
        .nav-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--ink); opacity: 0.12; }

        .nav-titles { display: flex; flex-direction: column; gap: 0.05rem; }

        .nav-accent {
          font-family: var(--font-display);
          font-size: 0.5rem; font-weight: 600;
          color: var(--cinnabar);
          letter-spacing: 0.35em; text-transform: uppercase; opacity: 0.7;
        }

        .nav-page-label {
          font-family: var(--font-display);
          font-size: 0.72rem; font-weight: 800;
          color: var(--ink);
          letter-spacing: 0.15em; opacity: 0.35; text-transform: uppercase;
        }

        /* Back button */
        .nav-back-btn {
          display: flex; align-items: center; gap: 0.45rem;
          padding: 0.45rem 0.75rem;
          background: transparent; border: none; border-radius: var(--radius-md);
          color: var(--ink);
          font-family: var(--font-display); font-size: 0.72rem; font-weight: 600;
          cursor: pointer;
          transition: all 0.25s var(--transition-smooth);
          opacity: 0.55; letter-spacing: 0.03em; position: relative;
        }

        .nav-back-btn:hover {
          opacity: 1; background: rgba(26, 26, 46, 0.06); transform: translateY(-1px);
        }
        .nav-back-btn:active { transform: translateY(0); background: rgba(26, 26, 46, 0.1); }

        .nav-back-btn::after {
          content: '';
          position: absolute; bottom: 2px; left: 50%;
          width: 0; height: 2px; border-radius: 1px;
          background: var(--indigo);
          transition: all 0.3s var(--transition-smooth); transform: translateX(-50%);
        }
        .nav-back-btn:hover::after { width: 70%; }

        .nav-back-btn .crisp-icon {
          opacity: 0.7;
          filter: brightness(0) saturate(100%);
        }
        .nav-back-btn:hover .crisp-icon { opacity: 1; transform: translateX(-2px); }

        /* Nav buttons */
        .nav-btn {
          display: flex; align-items: center; gap: 0.45rem;
          padding: 0.45rem 0.75rem;
          background: transparent; border: none; border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.25s var(--transition-smooth); position: relative;
        }

        .nav-btn:hover { background: rgba(26, 26, 46, 0.06); transform: translateY(-1px); }
        .nav-btn:active { transform: translateY(0); background: rgba(26, 26, 46, 0.1); }

        .nav-btn::after {
          content: '';
          position: absolute; bottom: 2px; left: 50%;
          width: 0; height: 2px; border-radius: 1px;
          transition: all 0.3s var(--transition-smooth); transform: translateX(-50%);
        }
        .nav-btn:hover::after { width: 70%; }

        .nav-btn-logout::after { background: var(--cinnabar); }
        .nav-btn-logout:hover { background: rgba(179, 58, 58, 0.06); }

        .nav-btn .crisp-icon {
          opacity: 0.55;
          filter: brightness(0) saturate(100%);
        }
        .nav-btn:hover .crisp-icon { opacity: 0.9; }
        .nav-btn-logout:hover .crisp-icon {
          filter: brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(89%) contrast(97%);
          opacity: 1;
        }

        .nav-btn-label {
          font-family: var(--font-body);
          font-size: 0.68rem; font-weight: 600;
          color: var(--ink); opacity: 0.45; letter-spacing: 0.04em;
          transition: all 0.25s;
        }
        .nav-btn:hover .nav-btn-label { opacity: 0.8; }
        .nav-btn-logout:hover .nav-btn-label { color: var(--cinnabar); opacity: 0.8; }

        /* Hanko stamp */
        .hanko-stamp {
          background: var(--cinnabar);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-weight: 800;
          color: var(--parchment); letter-spacing: 0.1em;
          position: relative; border: none;
        }

        .hanko-stamp::before {
          content: ''; position: absolute; inset: 3px;
          border: 1px solid var(--parchment); opacity: 0.3;
        }

        .hanko-stamp.nav-stamp {
          width: 36px; height: 36px; font-size: 0.35rem;
          transform: rotate(-8deg); border-radius: 2px;
          box-shadow: 1px 1px 0 var(--cinnabar-dark); flex-shrink: 0;
        }

        /* Version badge in nav */
        .version-badge-nav {
          display: flex; align-items: baseline; gap: 0.15rem;
          padding: 0.3rem 0.6rem;
          background: var(--ink);
          border-radius: 2px;
        }

        .version-label-nav {
          font-size: 0.5rem; font-weight: 700;
          color: var(--parchment); opacity: 0.5;
          letter-spacing: 0.05em;
        }

        .version-number-nav {
          font-family: var(--font-mono);
          font-size: 0.8rem; font-weight: 800;
          color: var(--sunflower);
        }

        /* Status indicator in nav */
        .status-indicator-nav {
          display: flex; align-items: center; gap: 0.35rem;
          padding: 0.3rem 0.6rem;
          background: var(--parchment-light);
          border: 1.5px solid var(--ink);
          border-radius: 2px;
        }

        .status-dot-nav {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--indigo-light);
        }

        .status-dot-nav.ready {
          animation: pulse-ready 2s infinite;
        }

        .status-dot-nav.processing {
          background: var(--sunflower);
          animation: pulse-processing 0.8s infinite;
        }

        .status-text-nav {
          font-size: 0.55rem; font-weight: 700;
          letter-spacing: 0.1em; color: var(--ink);
        }

        /* ═══════════════════════════════════════
           MAIN CONTENT
        ═══════════════════════════════════════ */

        .main-content {
          position: relative;
          z-index: 1;
          max-width: 1300px;
          margin: 0 auto;
          padding: 1.5rem 2rem 2rem;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.6s var(--transition-smooth);
        }

        .main-content.loaded {
          opacity: 1;
          transform: translateY(0);
        }

        /* ═══════════════════════════════════════
           CONTENT GRID
        ═══════════════════════════════════════ */

        .content-grid {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        @media (max-width: 1000px) {
          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        /* ═══════════════════════════════════════
           PANELS
        ═══════════════════════════════════════ */

        .panel {
          background: var(--parchment-light);
        }

        .panel-frame {
          border: 3px solid var(--ink);
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
          border-radius: var(--radius-sm);
        }

        .panel-frame::before {
          content: '';
          position: absolute;
          inset: 5px;
          border: 1px solid var(--ink);
          opacity: 0.1;
          pointer-events: none;
          border-radius: 1px;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 2px solid var(--ink);
          background: var(--parchment);
        }

        .panel-title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .panel-number {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--parchment);
          background: var(--ink);
          padding: 0.2rem 0.5rem;
          border-radius: 2px;
        }

        .panel-header h2 {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink);
        }

        /* Hanko Seal */
        .hanko-seal {
          width: 48px;
          height: 48px;
          border: 3px solid var(--cinnabar);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(-10deg);
          position: relative;
        }

        .seal-inner {
          width: 36px;
          height: 36px;
          border: 2px solid var(--cinnabar);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .seal-inner span {
          font-size: 0.45rem;
          font-weight: 900;
          color: var(--cinnabar);
          letter-spacing: 0.05em;
        }

        /* Terminal Status */
        .terminal-status {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--indigo-light);
        }

        .terminal-dot {
          width: 6px;
          height: 6px;
          background: var(--indigo-light);
          border-radius: 50%;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 50%, 100% { opacity: 1; }
          25%, 75% { opacity: 0.3; }
        }

        /* ═══════════════════════════════════════
           SKETCH PANEL
        ═══════════════════════════════════════ */

        .sketch-viewport {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
          min-height: 380px;
          background: linear-gradient(135deg, var(--parchment-light) 0%, var(--parchment) 100%);
        }

        .sketch-canvas {
          position: relative;
          transition: transform 0.3s var(--transition-smooth);
        }

        .sketch-frame {
          width: 280px;
          height: 280px;
          position: relative;
          background: var(--parchment);
          border: 4px solid var(--ink);
          box-shadow: 8px 8px 0 rgba(26, 26, 46, 0.1);
        }

        .frame-corners .fc {
          position: absolute;
          width: 20px;
          height: 20px;
          border-color: var(--cinnabar);
          border-style: solid;
        }

        .frame-corners .fc.tl { top: -8px; left: -8px; border-width: 3px 0 0 3px; }
        .frame-corners .fc.tr { top: -8px; right: -8px; border-width: 3px 3px 0 0; }
        .frame-corners .fc.bl { bottom: -8px; left: -8px; border-width: 0 0 3px 3px; }
        .frame-corners .fc.br { bottom: -8px; right: -8px; border-width: 0 3px 3px 0; }

        .sketch-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: contrast(1.05);
          image-rendering: -webkit-optimize-contrast;
        }

        .brush-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            transparent 45%,
            rgba(233, 196, 106, 0.05) 50%,
            transparent 55%
          );
          pointer-events: none;
        }

        .zoom-indicator {
          position: absolute;
          bottom: 1rem;
          right: 1rem;
          padding: 0.3rem 0.6rem;
          background: var(--ink);
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--parchment);
          border-radius: 2px;
        }

        /* Processing Overlay */
        .processing-overlay {
          position: absolute;
          inset: 0;
          background: rgba(245, 240, 225, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .processing-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .processing-rings {
          position: relative;
          width: 60px;
          height: 60px;
        }

        .ring {
          position: absolute;
          border: 3px solid transparent;
          border-radius: 50%;
        }

        .ring-1 {
          inset: 0;
          border-top-color: var(--cinnabar);
          animation: spin 1s linear infinite;
        }

        .ring-2 {
          inset: 8px;
          border-right-color: var(--indigo);
          animation: spin 1.5s linear infinite reverse;
        }

        .ring-3 {
          inset: 16px;
          border-bottom-color: var(--sunflower);
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .processing-text {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--ink);
        }

        .processing-dots {
          display: flex;
          gap: 4px;
        }

        .processing-dots span {
          width: 6px;
          height: 6px;
          background: var(--cinnabar);
          border-radius: 50%;
          animation: dotBounce 1.2s infinite;
        }

        .processing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .processing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }

        /* Sketch Controls */
        .sketch-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
          border-top: 2px solid var(--ink);
          background: var(--parchment);
        }

        .control-group {
          display: flex;
          gap: 0.4rem;
        }

        .control-btn {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--parchment-light);
          border: 2px solid var(--ink);
          cursor: pointer;
          transition: all 0.2s var(--transition-snap);
          border-radius: var(--radius-sm);
          padding: 0;
        }

        .control-btn .crisp-icon {
          width: 16px !important;
          height: 16px !important;
          opacity: 0.7;
          filter: brightness(0) saturate(100%);
          transition: filter 0.2s, opacity 0.2s, transform 0.2s var(--transition-smooth);
        }

        .control-btn svg {
          width: 16px;
          height: 16px;
          color: var(--ink);
          opacity: 0.7;
          transition: all 0.2s;
        }

        .control-btn:hover {
          background: var(--ink);
          transform: translateY(-2px);
          box-shadow: 0 3px 0 rgba(26, 26, 46, 0.2);
        }

        .control-btn:hover .crisp-icon {
          filter: brightness(0) invert(1);
          opacity: 1;
        }

        .control-btn:hover svg {
          color: var(--parchment);
          opacity: 1;
        }

        .control-btn:active {
          transform: translateY(0);
          box-shadow: none;
        }

        .control-divider {
          width: 1px;
          height: 24px;
          background: var(--ink);
          opacity: 0.2;
          margin: 0 0.5rem;
        }

        /* ═══════════════════════════════════════
           COMMAND PANEL
        ═══════════════════════════════════════ */

        .command-panel .panel-frame {
          min-height: 500px;
        }

        /* Terminal History */
        .terminal-history {
          flex: 1;
          padding: 1rem 1.25rem;
          overflow: hidden;
        }

        .history-scroll {
          height: 200px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-right: 0.5rem;
        }

        .history-entry {
          display: flex;
          gap: 0.75rem;
          padding: 0.6rem 0.8rem;
          background: var(--parchment);
          border-left: 3px solid var(--ink-muted);
          animation: entrySlide 0.3s var(--transition-smooth) both;
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        }

        @keyframes entrySlide {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .history-entry.user {
          border-left-color: var(--indigo);
          background: rgba(38, 70, 83, 0.05);
        }

        .history-entry.system {
          border-left-color: var(--sunflower);
        }

        .history-entry.error {
          border-left-color: var(--cinnabar);
          background: rgba(179, 58, 58, 0.05);
        }

        .history-entry.processing-entry {
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .entry-marker {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .entry-marker svg {
          width: 14px;
          height: 14px;
        }

        .history-entry.user .entry-marker svg { color: var(--indigo); }
        .history-entry.system .entry-marker svg { color: var(--gold); }
        .history-entry.error .entry-marker svg { color: var(--cinnabar); }

        .processing-spinner-small {
          width: 14px;
          height: 14px;
          border: 2px solid var(--parchment-dark);
          border-top-color: var(--indigo);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .entry-content {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .entry-text {
          font-size: 0.8rem;
          color: var(--ink);
          line-height: 1.4;
        }

        .entry-time {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          color: var(--ink-muted);
          white-space: nowrap;
        }

        /* Voice Active Panel */
        .voice-active-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.25rem;
          background: rgba(179, 58, 58, 0.08);
          border-top: 2px solid var(--cinnabar);
          border-bottom: 2px solid var(--cinnabar);
          animation: voicePanelPulse 2s infinite;
        }

        @keyframes voicePanelPulse {
          0%, 100% { background: rgba(179, 58, 58, 0.08); }
          50% { background: rgba(179, 58, 58, 0.12); }
        }

        .voice-visualizer {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .visualizer-bars {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 32px;
        }

        .visualizer-bars .bar {
          width: 3px;
          background: var(--cinnabar);
          border-radius: 2px;
          animation: barWave 0.5s ease-in-out infinite alternate;
        }

        @keyframes barWave {
          from { height: 8px; }
          to { height: 28px; }
        }

        .voice-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .voice-status {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: var(--cinnabar);
        }

        .voice-hint {
          font-size: 0.7rem;
          color: var(--ink-muted);
        }

        .stop-listening-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          background: var(--cinnabar);
          border: 2px solid var(--cinnabar-dark);
          color: var(--parchment);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: all 0.2s;
          border-radius: var(--radius-sm);
        }

        .stop-listening-btn svg {
          width: 14px;
          height: 14px;
        }

        .stop-listening-btn:hover {
          background: var(--cinnabar-dark);
        }

        /* Command Input Area */
        .command-input-area {
          padding: 1rem 1.25rem;
          border-top: 2px solid var(--ink);
          background: var(--parchment);
        }

        .input-row {
          display: flex;
          gap: 0.75rem;
        }

        .input-field-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          background: var(--parchment-light);
          border: 2px solid var(--ink);
          transition: border-color 0.2s;
          border-radius: var(--radius-sm);
        }

        .input-field-wrapper:focus-within {
          border-color: var(--indigo);
          box-shadow: 0 0 0 3px rgba(38, 70, 83, 0.1);
        }

        .input-prefix {
          padding: 0 0.75rem;
          font-family: var(--font-mono);
          font-size: 1rem;
          font-weight: 700;
          color: var(--indigo);
        }

        .command-input {
          flex: 1;
          padding: 0.75rem 0.75rem 0.75rem 0;
          background: transparent;
          border: none;
          font-family: var(--font-main);
          font-size: 0.9rem;
          color: var(--ink);
          outline: none;
        }

        .command-input::placeholder {
          color: var(--ink-muted);
          opacity: 0.5;
          font-style: italic;
        }

        .command-input:disabled {
          opacity: 0.5;
        }

        .input-actions {
          display: flex;
          gap: 0.5rem;
        }

        /* ═══════════════════════════════════════
           MICROPHONE BUTTON
        ═══════════════════════════════════════ */

        .mic-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          width: 64px;
          height: 54px;
          background: var(--indigo);
          border: 2px solid var(--ink);
          cursor: pointer;
          position: relative;
          transition: all 0.25s var(--transition-snap);
          overflow: hidden;
          border-radius: var(--radius-sm);
          padding: 0;
        }

        .mic-btn:hover:not(:disabled) {
          background: var(--indigo-light);
          transform: scale(1.05);
          box-shadow: 0 3px 8px rgba(38, 70, 83, 0.3);
        }

        .mic-btn:hover:not(:disabled) .crisp-icon {
          transform: scale(1.05);
        }

        .mic-btn.active {
          background: var(--cinnabar);
          border-color: var(--cinnabar-dark);
          animation: micPulse 1.5s infinite;
        }

        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(179, 58, 58, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(179, 58, 58, 0); }
        }

        .mic-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mic-icon-wrapper {
          position: relative;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mic-icon-wrapper .crisp-icon {
          position: relative;
          z-index: 2;
        }

        .mic-waves {
          position: absolute;
          inset: -8px;
          z-index: 1;
        }

        .mic-waves .wave {
          position: absolute;
          inset: 0;
          border: 2px solid var(--parchment);
          border-radius: 50%;
          opacity: 0;
          animation: waveExpand 1.5s infinite;
        }

        .mic-waves .wave-1 { animation-delay: 0s; }
        .mic-waves .wave-2 { animation-delay: 0.5s; }
        .mic-waves .wave-3 { animation-delay: 1s; }

        @keyframes waveExpand {
          0% {
            transform: scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        .mic-label {
          font-size: 0.5rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--parchment);
          transition: color 0.2s;
        }

        /* Send Button */
        .send-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0 1.25rem;
          background: var(--ink);
          border: 2px solid var(--ink);
          color: var(--parchment);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: all 0.2s var(--transition-snap);
          border-radius: var(--radius-sm);
        }

        .send-btn svg {
          width: 16px;
          height: 16px;
        }

        .send-btn:hover:not(:disabled) {
          background: var(--ink-light);
          transform: translateY(-2px);
          box-shadow: 0 4px 0 var(--ink);
        }

        .send-btn:hover:not(:disabled) .crisp-icon {
          transform: translateX(2px);
        }

        .send-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: none;
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Quick Commands */
        .quick-commands {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--parchment-dark);
        }

        .quick-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .quick-label {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--ink-muted);
          white-space: nowrap;
        }

        .quick-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, var(--ink-muted), transparent);
          opacity: 0.2;
        }

        .quick-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .quick-chip {
          padding: 0.4rem 0.7rem;
          background: var(--parchment);
          border: 1.5px solid var(--ink-muted);
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--ink-muted);
          cursor: pointer;
          transition: all 0.2s;
          border-radius: var(--radius-sm);
        }

        .quick-chip:hover:not(:disabled) {
          border-color: var(--indigo);
          color: var(--indigo);
          background: rgba(38, 70, 83, 0.05);
          transform: translateY(-1px);
        }

        .quick-chip:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* ═══════════════════════════════════════
           ACTION BAR
        ═══════════════════════════════════════ */

        .action-bar {
          display: flex;
          justify-content: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 1rem 1.5rem;
          border: var(--border-thick) solid var(--ink);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.25s var(--transition-snap);
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
        }

        .action-btn::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 3px;
          transform: scaleX(0);
          transform-origin: right;
          transition: transform 0.3s var(--transition-smooth);
        }

        .action-btn:hover::after {
          transform: scaleX(1);
          transform-origin: left;
        }

        .action-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 5px 0 var(--ink);
        }

        .action-btn:active {
          transform: translateY(0);
          box-shadow: none;
        }

        .action-btn svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .action-btn .crisp-icon {
          width: 18px !important;
          height: 18px !important;
        }

        .action-btn.primary {
          background: var(--ink);
          color: var(--parchment);
        }

        .action-btn.primary::after {
          background: var(--sunflower);
        }

        .action-btn.primary svg {
          color: var(--sunflower);
        }

        .action-btn.primary:hover {
          background: var(--ink-light);
        }

        .action-btn.secondary {
          background: var(--indigo);
          border-color: var(--indigo);
          color: var(--parchment);
        }

        .action-btn.secondary::after {
          background: var(--indigo-light);
        }

        .action-btn.secondary:hover {
          background: var(--indigo-light);
        }

        .action-btn.secondary:hover .crisp-icon {
          transform: scale(1.1);
        }

        .action-btn.tertiary {
          background: var(--parchment);
          color: var(--ink);
        }

        .action-btn.tertiary::after {
          background: var(--cinnabar);
        }

        .action-btn.tertiary:hover {
          background: var(--parchment-dark);
        }

        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        /* ═══════════════════════════════════════
           FOOTER
        ═══════════════════════════════════════ */

        .page-footer {
          margin-top: 3rem;
          padding-top: 1.5rem;
          text-align: center;
        }

        .footer-decoration {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .deco-line {
          width: 100px;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--ink-muted), transparent);
        }

        .deco-emblem {
          width: 28px;
          height: 28px;
          color: var(--cinnabar);
          opacity: 0.4;
        }

        .deco-emblem svg {
          width: 100%;
          height: 100%;
        }

        .footer-text {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: var(--ink-muted);
          opacity: 0.6;
        }

        /* ═══════════════════════════════════════
           MODAL
        ═══════════════════════════════════════ */

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26, 26, 46, 0.85);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-container {
          width: 100%;
          max-width: 480px;
          animation: modalSlide 0.4s var(--transition-snap);
        }

        @keyframes modalSlide {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-frame {
          background: var(--parchment);
          border: 3px solid var(--ink);
          position: relative;
          border-radius: var(--radius-sm);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 2px solid var(--ink);
        }

        .modal-title-group {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .modal-hanko {
          width: 48px;
          height: 48px;
          background: var(--cinnabar);
          border: 2px solid var(--cinnabar-dark);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(-5deg);
          border-radius: 2px;
        }

        .modal-hanko span {
          font-size: 0.6rem;
          font-weight: 900;
          color: var(--parchment);
          letter-spacing: 0.05em;
        }

        .modal-titles {
          display: flex;
          flex-direction: column;
        }

        .modal-tag {
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--cinnabar);
        }

        .modal-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--ink);
        }

        .modal-close {
          width: 36px;
          height: 36px;
          background: transparent;
          border: 2px solid var(--ink);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          border-radius: var(--radius-sm);
          padding: 0;
        }

        .modal-close .crisp-icon {
          width: 16px !important;
          height: 16px !important;
          filter: brightness(0) saturate(100%);
          opacity: 0.7;
        }

        .modal-close:hover {
          background: var(--ink);
        }

        .modal-close:hover .crisp-icon {
          filter: brightness(0) invert(1);
          opacity: 1;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-description {
          font-size: 0.85rem;
          color: var(--ink-muted);
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .export-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .export-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--parchment-light);
          border: 2px solid var(--ink);
          cursor: pointer;
          text-align: left;
          transition: all 0.2s var(--transition-snap);
          border-radius: var(--radius-sm);
        }

        .export-card:hover {
          transform: translateX(5px);
          box-shadow: -5px 0 0 var(--ink);
        }

        .export-icon-box {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--ink);
          border-radius: var(--radius-sm);
        }

        .export-icon-box.png { background: rgba(38, 70, 83, 0.1); }
        .export-icon-box.jpg { background: rgba(42, 157, 143, 0.1); }
        .export-icon-box.pdf { background: rgba(179, 58, 58, 0.1); }

        .export-icon-box .crisp-icon {
          width: 18px !important;
          height: 18px !important;
          filter: brightness(0) saturate(100%);
          opacity: 0.7;
        }

        .export-icon-box svg {
          width: 22px;
          height: 22px;
          color: var(--ink);
        }

        .export-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .export-format {
          font-size: 1rem;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: 0.05em;
        }

        .export-desc {
          font-size: 0.75rem;
          color: var(--ink-muted);
        }

        .export-arrow {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-muted);
          transition: all 0.2s;
        }

        .export-card:hover .export-arrow {
          color: var(--ink);
          transform: translateX(4px);
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--parchment-dark);
          text-align: center;
        }

        .modal-cancel {
          padding: 0.75rem 2rem;
          background: transparent;
          border: 2px solid var(--ink-muted);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--ink-muted);
          cursor: pointer;
          transition: all 0.2s;
          border-radius: var(--radius-sm);
        }

        .modal-cancel:hover {
          border-color: var(--ink);
          color: var(--ink);
        }

        /* ═══════════════════════════════════════
           RESPONSIVE
        ═══════════════════════════════════════ */

        @media (max-width: 1000px) {
          .sketch-frame {
            width: 240px;
            height: 240px;
          }
        }

        @media (max-width: 600px) {
          .sketch-container { padding-top: 4.5rem; }
          .top-nav { padding: 0 1rem; height: 50px; }
          .nav-titles { display: none; }
          .nav-sep { display: none; }
          .nav-back-btn span { display: none; }
          .nav-btn-label { display: none; }
          .nav-dot { display: none; }
          .version-badge-nav { display: none; }
          .status-indicator-nav { display: none; }
          .hanko-stamp.nav-stamp { width: 30px; height: 30px; font-size: 0.3rem; }

          .crisp-icon { width: 18px !important; height: 18px !important; }

          .main-content {
            padding: 1rem;
          }

          .sketch-frame {
            width: 200px;
            height: 200px;
          }

          .input-row {
            flex-wrap: wrap;
          }

          .input-field-wrapper {
            width: 100%;
          }

          .input-actions {
            width: 100%;
          }

          .mic-btn {
            flex: 1;
          }

          .send-btn {
            flex: 2;
            justify-content: center;
          }

          .action-bar {
            flex-direction: column;
          }

          .action-btn {
            width: 100%;
            justify-content: center;
          }
        }

        /* ═══════════════════════════════════════
           IMMERSIVE LOADER OVERLAY
        ═══════════════════════════════════════ */
        .immersive-loader-overlay {
          position: fixed; inset: 0;
          background: rgba(15, 15, 25, 0.9);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          z-index: 5000; padding: 2rem;
          color: var(--parchment);
          animation: overlayFadeIn 0.4s ease-out;
        }

        .loader-content-v2 {
          display: flex; flex-direction: column; align-items: center;
          gap: 2.5rem; max-width: 400px; text-align: center;
        }

        .loader-visual-v2 {
          position: relative; width: 120px; height: 120px;
          display: flex; align-items: center; justify-content: center;
        }

        .pulse-ring-v2 {
          position: absolute; inset: 0;
          border: 2px solid var(--cinnabar);
          border-radius: 50%; opacity: 0.2;
          animation: ringPulseV2 2.5s infinite ease-out;
        }
        .pulse-ring-v2:nth-child(2) { animation-delay: 0.8s; }
        .pulse-ring-v2:nth-child(3) { animation-delay: 1.6s; }

        @keyframes ringPulseV2 {
          0% { transform: scale(0.4); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        .central-icon-v2 {
          position: relative; z-index: 2;
          color: var(--parchment);
          filter: drop-shadow(0 0 15px rgba(245, 240, 225, 0.4));
          animation: iconFloatV2 3s infinite ease-in-out;
        }
        .loader-svg { width: 56px; height: 56px; }

        @keyframes iconFloatV2 {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-12px) rotate(5deg); }
        }

        .loader-text-v2 {
          display: flex; flex-direction: column; gap: 0.8rem; width: 100%;
        }

        .loader-status-v2 {
          font-family: var(--font-mono); font-size: 0.75rem; 
          font-weight: 800; letter-spacing: 0.4em; color: var(--cinnabar);
          text-transform: uppercase; animation: blink-v2 1.5s infinite;
        }
        @keyframes blink-v2 { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        .loader-title-v2 {
          font-family: var(--font-body); font-size: 1.25rem; 
          font-weight: 700; color: var(--parchment); margin: 0;
        }

        .loader-progress-v2 {
          width: 100%; height: 3px; background: rgba(245, 240, 225, 0.1);
          border-radius: 4px; overflow: hidden; position: relative; margin-top: 0.5rem;
        }
        .progress-fill-v2 {
          position: absolute; top: 0; left: 0; height: 100%; width: 50%;
          background: var(--cinnabar); animation: progressV2 1.8s infinite ease-in-out;
        }
        @keyframes progressV2 { 0% { left: -50%; } 100% { left: 100%; } }

        .loader-hint-v2 {
          font-size: 0.75rem; color: var(--parchment); opacity: 0.6;
          line-height: 1.6; font-style: italic; max-width: 320px;
        }

        .scan-line-v3 {
          position: fixed; inset: 0;
          background: linear-gradient(to bottom, transparent, rgba(179, 58, 58, 0.08), transparent);
          height: 15vh; width: 100%; pointer-events: none;
          animation: scanV3 4s linear infinite; z-index: 5001;
        }
        @keyframes scanV3 { from { top: -20vh; } to { top: 120vh; } }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        ::-webkit-scrollbar-track {
          background: var(--parchment-dark);
        }

        ::-webkit-scrollbar-thumb {
          background: var(--ink-muted);
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: var(--ink);
        }

        /* ═══════════════════════════════════════
           SELECTION & UTILITIES
        ═══════════════════════════════════════ */

        ::selection {
          background: var(--sunflower);
          color: var(--ink);
        }

        @keyframes pulse-ready {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes pulse-processing {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
      `}</style>
    </div >
  );
}