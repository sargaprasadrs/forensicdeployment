// src/HomePage.js
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, storage } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  ImagePlus,
  Trash2,
  PenTool,
  XCircle,
  CheckCircle,
  Layers,
  Clock,
  ChevronRight,
  BookmarkPlus,
  Bookmark,
  Lock,
  ShieldAlert,
} from "lucide-react";

import feedbackIcon from "./assets/feedback.png";
import profileIcon from "./assets/profile.png";
import logoutIcon from "./assets/logout.png";
import micIcon from "./assets/mic.png";
import sendIcon from "./assets/send.png";
import closeIcon from "./assets/close.png";

const MAX_CACHED = 6;
const getUserCacheKey = (uid) => `ft_cached_descriptions_${uid}`;
const getUserCurrentKey = (uid) => `ft_current_description_${uid}`;

function HomePage() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [description, setDescription] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [cachedDescriptions, setCachedDescriptions] = useState([]);
  const [showCachePanel, setShowCachePanel] = useState(false);
  const [savePulse, setSavePulse] = useState(false);
  const [currentUid, setCurrentUid] = useState(null);
  const [genMode, setGenMode] = useState("pencil_sketch"); // 'pencil_sketch' or 'realistic_photo'
  const [lastGeneratedImage, setLastGeneratedImage] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [extractedFeatures, setExtractedFeatures] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const cachePanelRef = useRef(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        logUserActivity("PAGE", "HOME_VIEW");
        setCurrentUid(user.uid);
        
        // Load settings/cache for this user
        const savedCache = localStorage.getItem(getUserCacheKey(user.uid));
        if (savedCache) {
          try { setCachedDescriptions(JSON.parse(savedCache)); } catch { setCachedDescriptions([]); }
        }
        
        const currentSaved = localStorage.getItem(getUserCurrentKey(user.uid));
        if (currentSaved) setDescription(currentSaved);

        // Load last generated sketch (global or user-specific if preferred)
        const lastImg = localStorage.getItem("generatedSketch");
        if (lastImg) setLastGeneratedImage(`data:image/png;base64,${lastImg}`);
      } else {
        logUserActivity("PAGE", "GUEST_HOME_VIEW");
        setCurrentUid(null);
        setCachedDescriptions([]);
      }
    });
    return () => unsubscribe();
  }, []);
  const navigate = useNavigate();

  const logUserActivity = async (type, action, meta = {}) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      await addDoc(collection(db, "user_activity"), {
        uid: user.uid,
        email: user.email,
        type,
        action,
        meta,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Activity log failed:", err);
    }
  };

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!currentUid) return;
    const timeout = setTimeout(() => {
      if (description.trim()) {
        localStorage.setItem(getUserCurrentKey(currentUid), description);
      } else {
        // Remove from localStorage when description is empty
        localStorage.removeItem(getUserCurrentKey(currentUid));
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [description, currentUid]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        cachePanelRef.current &&
        !cachePanelRef.current.contains(e.target)
      ) {
        setShowCachePanel(false);
      }
    };
    if (showCachePanel)
      document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [showCachePanel]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setShowFeedbackModal(false);
        setShowCachePanel(false);
        resetFeedbackForm();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const resetFeedbackForm = () => {
    setFeedbackText("");
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setFeedbackSuccess(false);
  };

  const getPreviewText = (text, maxLen = 45) => {
    const cleaned = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    return cleaned.length <= maxLen
      ? cleaned
      : cleaned.substring(0, maxLen) + "…";
  };

  const saveToCache = () => {
    if (!description.trim() || !currentUid) return;
    const newEntry = {
      id: Date.now(),
      text: description.trim(),
      preview: getPreviewText(description),
      savedAt: new Date().toISOString(),
    };
    if (cachedDescriptions.some((c) => c.text === newEntry.text)) {
      setSavePulse(true);
      setTimeout(() => setSavePulse(false), 600);
      return;
    }
    const updated = [newEntry, ...cachedDescriptions].slice(0, MAX_CACHED);
    setCachedDescriptions(updated);
    localStorage.setItem(
      getUserCacheKey(currentUid),
      JSON.stringify(updated)
    );
    setSavePulse(true);
    setTimeout(() => setSavePulse(false), 600);
    logUserActivity("CACHE", "SAVE_DESCRIPTION", {
      previewLength: newEntry.preview.length,
    });
  };

  const loadFromCache = (entry) => {
    setDescription(entry.text);
    setShowCachePanel(false);
    logUserActivity("CACHE", "LOAD_DESCRIPTION", { id: entry.id });
  };

  const removeFromCache = (id, e) => {
    e.stopPropagation();
    const updated = cachedDescriptions.filter((c) => c.id !== id);
    setCachedDescriptions(updated);
    if (currentUid)
      localStorage.setItem(
        getUserCacheKey(currentUid),
        JSON.stringify(updated)
      );
  };

  const clearAllCache = () => {
    setCachedDescriptions([]);
    if (currentUid) localStorage.removeItem(getUserCacheKey(currentUid));
  };

  const clearUserCache = (uid) => {
    localStorage.removeItem(getUserCacheKey(uid));
    localStorage.removeItem(getUserCurrentKey(uid));
  };

  const formatTimeAgo = (isoString) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const initializeRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(chunksRef.current, {
          type: "audio/webm",
        });
        chunksRef.current = [];
        const formData = new FormData();
        formData.append("file", audioBlob);
        try {
          const response = await fetch(
            "http://localhost:5000/api/transcribe",
            { method: "POST", body: formData }
          );
          const data = await response.json();
          if (data.success) {
            setDescription((prev) => {
              const cleanedPrev = prev.endsWith("\nListening...")
                ? prev.slice(0, -12)
                : prev;
              return cleanedPrev
                ? `${cleanedPrev}\nWitness: ${data.text}`
                : `Witness: ${data.text}`;
            });
          } else {
            setDescription((prev) => {
              const cleanedPrev = prev.endsWith("\nListening...")
                ? prev.slice(0, -12)
                : prev;
              return `${cleanedPrev}\nERROR: ${data.error}`;
            });
          }
        } catch (error) {
          console.error("Transcription error:", error);
          setDescription((prev) => {
            const cleanedPrev = prev.endsWith("\nListening...")
              ? prev.slice(0, -12)
              : prev;
            return `${cleanedPrev}\nERROR: Failed to transcribe audio`;
          });
        }
        setIsProcessing(false);
      };
      return true;
    } catch (error) {
      console.error("Media device error:", error);
      alert("Could not access microphone.");
      return false;
    }
  };

  const handleVoiceInput = async () => {
    if (!isListening) {
      const initialized = await initializeRecording();
      if (!initialized) return;
      setIsListening(true);
      setDescription((prev) => `${prev}\nListening...`);
      logUserActivity("VOICE", "RECORD_START");
      mediaRecorderRef.current.start();
    } else {
      setIsListening(false);
      logUserActivity("VOICE", "RECORD_STOP");
      if (mediaRecorderRef.current?.state === "recording")
        mediaRecorderRef.current.stop();
    }
  };

  const extractFeaturesWithLLM = async () => {
    // 1. Show login gate to guests FIRST (even if empty description)
    if (!authUser && !authLoading) {
      setShowLoginGate(true);
      return;
    }

    if (!description.trim()) return;

    // Wait for auth to initialize or check immediately
    if (authLoading) return;

    if (!authUser) {
      setShowLoginGate(true);
      return;
    }

    saveToCache();
    setIsGenerating(true);

    logUserActivity("AI", "EXTRACT_FEATURES", {
      textLength: description.length,
    });

    try {
      const llmRes = await fetch("http://127.0.0.1:5000/api/llm-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: description }),
      });
      const llmData = await llmRes.json();
      if (!llmData.success) {
        alert("LLM extraction failed");
        setIsGenerating(false);
        return;
      }

      setExtractedFeatures(llmData.features);
      setIsGenerating(false);
      setIsConfirming(true);

      logUserActivity("AI", "FEATURES_EXTRACTED");
    } catch (err) {
      console.error(err);
      alert("Backend error during extraction");
      setIsGenerating(false);
    }
  };

  const confirmAndGenerate = async () => {
    if (!extractedFeatures) return;

    setIsConfirming(false);
    setIsGenerating(true);

    logUserActivity("AI", "CONFIRM_AND_GENERATE");

    try {
      const richPrompt = extractedFeatures.rich_prompt || "";

      // The LLM now returns all features in a 'features' dictionary
      const dynamicFeatures = (extractedFeatures && extractedFeatures.features) || {};

      localStorage.setItem(
        "extractedFeatures",
        JSON.stringify(dynamicFeatures)
      );

      let prompt = "";
      let negative_prompt = "";

      if (genMode === "pencil_sketch") {
        prompt = `professional forensic pencil sketch, highly detailed graphite illustration, charcoal artist style, fine pencil strokes, grayscale, paper texture, 
${richPrompt ? `${richPrompt},` : ""}
meticulous facial features, hand-drawn look, masterpiece`;
        negative_prompt = "color, photograph, photorealistic, digital painting, smooth skin, cartoon, 3d render, watermark, signature, blurry, low quality";
      } else if (genMode === "realistic_photo") {
        prompt = `hyper-realistic 8k portrait photograph, highly detailed skin texture, cinematic lighting, 
${richPrompt ? `${richPrompt},` : ""}
sharp focus, deep shadows, professional forensic photography, masterpiece`;
        negative_prompt = "sketch, drawing, graphite, charcoal, illustration, cartoon, anime, blurry, low quality, watermark, signature, deformed";
      } else if (genMode === "gan_hq") {
        // FLUX (GAN) Mode - Keep as is but ensure robust prompt
        prompt = `A hyper-realistic, high-fidelity forensic portrait, ${richPrompt}. 
Masterpiece, 8k, detailed facial features, professional photography, cinematic lighting, ultra-detailed skin.`;
        negative_prompt = "sketch, drawing, cartoon, anime"; 
      }

      setCurrentPrompt(prompt);

      const imgRes = await fetch(
        "http://127.0.0.1:5000/api/generate-image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, negative_prompt, mode: genMode }),
        }
      );
      const imgData = await imgRes.json();
      if (!imgData.success) {
        alert("Image generation failed: " + (imgData.error || "Unknown error"));
        setIsGenerating(false);
        return;
      }
      setPreviewImages(imgData.images.map(img => `data:image/png;base64,${img}`));
      setIsGenerating(false);
      setIsPreviewing(true);

    } catch (err) {
      console.error(err);
      alert("Backend error (image generation)");
      setIsGenerating(false);
    }
  };

  const finalizeSelection = () => {
    if (selectedImageIndex === null) return;

    // Get the base64 part only
    const pickedImage = previewImages[selectedImageIndex].split(',')[1];
    localStorage.setItem("generatedSketch", pickedImage);
    localStorage.setItem("lastPrompt", currentPrompt);
    localStorage.setItem("generationMode", genMode);
    setLastGeneratedImage(previewImages[selectedImageIndex]);

    setIsPreviewing(false);
    navigate("/attributes");
  };


  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setScreenshotPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setIsSubmittingFeedback(true);
    try {
      const user = auth.currentUser;
      let screenshotURL = null;
      if (screenshotFile) {
        const timestamp = Date.now();
        const fileName = `feedback_screenshots/${user?.uid || "anonymous"}/${timestamp}_${screenshotFile.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, screenshotFile);
        screenshotURL = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, "feedback"), {
        userId: user?.uid || "anonymous",
        email: user?.email || "anonymous",
        message: feedbackText.trim(),
        screenshotURL,
        createdAt: serverTimestamp(),
        page: "home",
      });
      await logUserActivity("FEEDBACK", "SUBMIT", {
        hasScreenshot: !!screenshotFile,
      });
      setFeedbackSuccess(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        resetFeedbackForm();
      }, 2000);
    } catch (error) {
      console.error("Feedback submission error:", error);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logUserActivity("AUTH", "LOGOUT");

      // Clear ALL user cache data on logout
      if (currentUid) {
        clearUserCache(currentUid);
        // Also clear the local state
        setDescription("");
        setCachedDescriptions([]);
        setCurrentUid(null);
      }

      await auth.signOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleProfileClick = () => navigate("/profile");

  const handleCloseFeedbackModal = () => {
    setShowFeedbackModal(false);
    resetFeedbackForm();
  };

  return (
    <div className="neo-edo-container">
      <div className="paper-texture" />

      <svg
        className="ink-splatter top-left"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <circle cx="20" cy="20" r="15" fill="var(--cinnabar)" opacity="0.1" />
        <circle cx="35" cy="30" r="8" fill="var(--cinnabar)" opacity="0.08" />
        <circle cx="15" cy="40" r="5" fill="var(--cinnabar)" opacity="0.06" />
      </svg>
      <svg
        className="ink-splatter bottom-right"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <circle cx="80" cy="80" r="12" fill="var(--indigo)" opacity="0.08" />
        <circle cx="65" cy="70" r="6" fill="var(--indigo)" opacity="0.06" />
      </svg>

      {/* ═══ NAVIGATION ═══ */}
      <nav className="top-nav">
        <div className="nav-left">
          <div className="nav-logo">
            <span>FT</span>
          </div>
          <div className="nav-divider" />
          <span className="nav-title">FACE TRACE</span>
        </div>
        <div className="nav-right">
          <button
            className="nav-btn"
            onClick={() => setShowFeedbackModal(true)}
            title="Feedback"
          >
            <img
              src={feedbackIcon}
              alt="Feedback"
              className="crisp-icon nav-icon-size"
            />
            <span className="nav-btn-label">Feedback</span>
          </button>

          <span className="nav-dot" />

          {auth.currentUser ? (
            <>
              <button
                className="nav-btn"
                onClick={handleProfileClick}
                title="Profile"
              >
                <img
                  src={profileIcon}
                  alt="Profile"
                  className="crisp-icon nav-icon-size"
                />
                <span className="nav-btn-label">Profile</span>
              </button>

              <span className="nav-dot" />

              <button
                className="nav-btn nav-btn-logout"
                onClick={handleLogout}
                title="Logout"
              >
                <img
                  src={logoutIcon}
                  alt="Logout"
                  className="crisp-icon nav-icon-size"
                />
                <span className="nav-btn-label">Logout</span>
              </button>
            </>
          ) : (
            <button
              className="nav-btn nav-btn-login premium-pulse"
              onClick={() => navigate("/login")}
              title="Sign In"
            >
              <img
                src={profileIcon}
                alt="Login"
                className="crisp-icon nav-icon-size inverted"
              />
              <span className="nav-btn-label">Access System</span>
            </button>
          )}
        </div>
      </nav>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="modal-overlay" onClick={handleCloseFeedbackModal}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-panel">
              <div className="panel-corners">
                <div className="corner top-left" />
                <div className="corner top-right" />
                <div className="corner bottom-left" />
                <div className="corner bottom-right" />
              </div>
              <button
                className="modal-close-btn"
                onClick={handleCloseFeedbackModal}
                type="button"
              >
                <img src={closeIcon} alt="Close" className="crisp-icon" />
              </button>
              <div className="modal-header">
                <span className="panel-number">FB</span>
                <h2>Share Your Feedback</h2>
              </div>
              {feedbackSuccess ? (
                <div className="feedback-success">
                  <div className="success-icon">
                    <CheckCircle size={48} />
                  </div>
                  <span>Thank you for your feedback!</span>
                </div>
              ) : (
                <>

                  <div className="feedback-input-section">
                    <label className="feedback-label">
                      <span className="label-text">Your Thoughts</span>
                      <span className="label-line" />
                    </label>
                    <textarea
                      className="feedback-textarea"
                      placeholder="Tell us about your experience, suggestions, or any issues you encountered..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <div className="screenshot-section">
                    <label className="feedback-label">
                      <span className="label-text">
                        Upload Screenshot (Optional)
                      </span>
                      <span className="label-line" />
                    </label>
                    {!screenshotPreview ? (
                      <div className="screenshot-upload-area">
                        <input
                          type="file"
                          id="screenshot"
                          ref={fileInputRef}
                          accept="image/*"
                          onChange={handleScreenshotChange}
                          className="screenshot-input"
                        />
                        <label
                          htmlFor="screenshot"
                          className="screenshot-label"
                        >
                          <div className="upload-icon">
                            <ImagePlus size={40} />
                          </div>
                          <span className="upload-text">
                            Click to upload image
                          </span>
                          <span className="upload-hint">
                            PNG, JPG up to 5MB
                          </span>
                        </label>
                      </div>
                    ) : (
                      <div className="screenshot-preview">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot preview"
                        />
                        <button
                          type="button"
                          className="remove-screenshot-btn"
                          onClick={removeScreenshot}
                        >
                          <img
                            src={closeIcon}
                            alt="Remove"
                            className="crisp-icon inverted remove-icon-size"
                          />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="modal-btn secondary"
                      onClick={handleCloseFeedbackModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="modal-btn primary"
                      onClick={handleSubmitFeedback}
                      disabled={
                        isSubmittingFeedback || !feedbackText.trim()
                      }
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <div className="btn-loader" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <img
                            src={sendIcon}
                            alt="Send"
                            className="crisp-icon inverted"
                          />
                          <span>Submit Feedback</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Login Gate Modal */}
      {showLoginGate && (
        <div className="modal-overlay" onClick={() => setShowLoginGate(false)}>
          <div className="modal-container login-gate-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowLoginGate(false)}>
              <div className="crisp-icon-wrapper">
                <XCircle size={24} className="crisp-icon" />
              </div>
            </button>
            <div className="modal-header">
              <span className="panel-number">AUTH</span>
              <h2>Authentication Required</h2>
            </div>
            <div className="gate-content">
              <div className="gate-icon-wrapper">
                <div className="gate-rings">
                  <div className="ring" />
                  <div className="ring" />
                </div>
                <BookmarkPlus size={48} className="gate-main-icon" />
              </div>
              <p className="gate-text">
                To access the **Neural Synthesis Interface** and generate high-fidelity forensic sketches, you must be logged into the investigator system.
              </p>
              <div className="gate-features">
                <div className="gate-feature">
                  <CheckCircle size={16} />
                  <span>Cloud Synchronization</span>
                </div>
                <div className="gate-feature">
                  <CheckCircle size={16} />
                  <span>Evidence Persistence</span>
                </div>
                <div className="gate-feature">
                  <CheckCircle size={16} />
                  <span>Advanced Model Access</span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setShowLoginGate(false)}>
                Stay as Guest
              </button>
              <button 
                className="modal-btn primary premium-pulse" 
                onClick={() => {
                  setShowLoginGate(false);
                  navigate("/login");
                }}
              >
                Initialize Login
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={`main-content ${isLoaded ? "loaded" : ""}`}>
        <header className="hero-banner">
          <div className="hero-content">
            <div className="brush-stroke-container">
              <h1 className="main-title">
                <span className="title-accent">Next-Gen Forensic Intelligence</span>
                <span className="title-main">FACE TRACE</span>
              </h1>
              <div className="title-underline" />
            </div>
            <p className="hero-subtitle">
              Transforming witness testimonies into high-fidelity forensic sketches 
              using advanced neural synthesis and linguistic analysis.
            </p>
            {!auth.currentUser && (
              <div className="hero-cta">
                <button className="cta-button" onClick={() => navigate("/login")}>
                  <span>Initialize Investigator Account</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
          <div className="hero-visual-bg" />
        </header>

        <div className="manga-grid">
          <section className="manga-panel voice-panel">
            <div className="panel-header">
              <span className="panel-number">01</span>
              <h2>Voice Capture</h2>
            </div>
            <div className="voice-visualizer">
              <div className={`sound-wave ${isListening ? "active" : ""}`}>
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="wave-bar"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
              <button
                className={`stamp-button ${isListening ? "recording" : ""} ${isProcessing ? "processing" : ""}`}
                onClick={handleVoiceInput}
                disabled={isProcessing}
              >
                <div className="stamp-inner">
                  <img
                    src={micIcon}
                    alt="Mic"
                    className="crisp-icon mic-stamp-icon"
                  />
                </div>
                <span className="stamp-label">
                  {isProcessing
                    ? "PROCESSING..."
                    : isListening
                      ? "STOP"
                      : "RECORD"}
                </span>
              </button>
            </div>
          </section>

          <section className="manga-panel description-panel">
            <div className="panel-header">
              <span className="panel-number">02</span>
              <h2>Witness Statement</h2>
              <div className="panel-header-actions">
                <button
                  className={`cache-save-btn ${savePulse ? "pulse" : ""}`}
                  onClick={saveToCache}
                  disabled={!description.trim()}
                  title="Save description"
                >
                  <BookmarkPlus size={16} />
                </button>
                <div className="cache-dropdown-wrapper" ref={cachePanelRef}>
                  <button
                    className={`cache-load-btn ${cachedDescriptions.length > 0 ? "has-items" : ""}`}
                    onClick={() => setShowCachePanel(!showCachePanel)}
                    title="Saved descriptions"
                  >
                    <Bookmark size={16} />
                    {cachedDescriptions.length > 0 && (
                      <span className="cache-count">
                        {cachedDescriptions.length}
                      </span>
                    )}
                  </button>
                  {showCachePanel && (
                    <div className="cache-panel">
                      <div className="cache-panel-header">
                        <span className="cache-panel-title">
                          <Clock size={13} />
                          Saved Statements
                        </span>
                        {cachedDescriptions.length > 0 && (
                          <button
                            className="cache-clear-all"
                            onClick={clearAllCache}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      {cachedDescriptions.length === 0 ? (
                        <div className="cache-empty">
                          <Bookmark size={20} />
                          <span>No saved statements yet</span>
                        </div>
                      ) : (
                        <div className="cache-list">
                          {cachedDescriptions.map((entry) => (
                            <button
                              key={entry.id}
                              className="cache-item"
                              onClick={() => loadFromCache(entry)}
                            >
                              <div className="cache-item-content">
                                <span className="cache-item-text">
                                  {entry.preview}
                                </span>
                                <span className="cache-item-time">
                                  {formatTimeAgo(entry.savedAt)}
                                </span>
                              </div>
                              <div className="cache-item-actions">
                                <ChevronRight
                                  size={14}
                                  className="cache-item-arrow"
                                />
                                <button
                                  className="cache-item-delete"
                                  onClick={(e) =>
                                    removeFromCache(entry.id, e)
                                  }
                                  title="Remove"
                                >
                                  <img
                                    src={closeIcon}
                                    alt="Remove"
                                    className="crisp-icon cache-delete-icon"
                                  />
                                </button>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="scroll-container">
              <textarea
                className="description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  "Enter witness description here...\n\ne.g. The suspect had dark hair and a scar above his left eye..."
                }
              />
              <div className="scroll-decoration top" />
              <div className="scroll-decoration bottom" />
            </div>
          </section>

          {/* Recent Generation Preview */}
          {lastGeneratedImage && (
            <section className="manga-panel preview-panel">
              <div className="panel-header">
                <span className="panel-number">PREVIEW</span>
                <h2>Recent Generation</h2>
              </div>
              <div className="recent-sketch-container">
                <div className="sketch-frame mini">
                  <img src={lastGeneratedImage} alt="Last Generated" className="sketch-image" />
                </div>
                <div className="preview-actions">
                  <button className="preview-btn" onClick={() => navigate("/attributes")}>
                    REFINE SKETCH
                  </button>
                  <button className="preview-btn secondary" onClick={() => setLastGeneratedImage(null)}>
                    DISMISS
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="style-selector-container">
          <div className="style-label">Generation Mode</div>
          <div className="style-toggle-group">
            <button
              className={`style-toggle-btn ${genMode === "pencil_sketch" ? "active" : ""}`}
              onClick={() => setGenMode("pencil_sketch")}
            >
              PENCIL SKETCH
            </button>
            <button
              className={`style-toggle-btn ${genMode === "realistic_photo" ? "active" : ""}`}
              onClick={() => setGenMode("realistic_photo")}
            >
              REALISTIC PHOTO
            </button>
            <button
              className={`style-toggle-btn ${genMode === "gan_hq" ? "active" : ""}`}
              onClick={() => setGenMode("gan_hq")}
            >
              TRANSFORMER (HQ)
            </button>
          </div>
        </div>

        <div className="action-bar-container">
          {authUser ? (
            <div className="investigator-badge">
              <CheckCircle size={14} className="notice-icon" />
              <span>Investigator Verified</span>
            </div>
          ) : (
            !authLoading && (
              <div className="guest-notice">
                <ShieldAlert size={14} className="notice-icon" />
                <span>Login required for neural synthesis</span>
              </div>
            )
          )}
          <div className="action-bar">
            <button
              className={`action-button primary ${!authUser ? "guest-lock" : ""} ${authUser && description.trim() ? "ready-pulse" : ""}`}
              onClick={extractFeaturesWithLLM}
              disabled={isGenerating || (authUser && !description.trim())}
              title={!authUser ? (authLoading ? "Initializing..." : "Login Required") : (description.trim() ? "Generate Sketch" : "Description Required")}
            >
              {!authUser ? (
                <Lock size={18} className="btn-icon lock-icon" />
              ) : (
                <PenTool size={18} className="btn-icon" />
              )}
              <span>{isGenerating ? "EXTRACTING..." : "GENERATE SKETCH"}</span>
            </button>
            <button
              className="action-button secondary"
              onClick={() => {
                setDescription("");
                if (currentUid) {
                  localStorage.removeItem(getUserCurrentKey(currentUid));
                }
              }}
            >
              <Trash2 size={18} className="btn-icon" />
              <span>CLEAR</span>
            </button>
            {isGenerating && (
              <button className="action-button secondary">
                <XCircle size={18} className="btn-icon" />
                <span>CANCEL</span>
              </button>
            )}
          </div>
        </div>

        <footer className="footer-decoration">
          <div className="horizontal-rule">
            <div className="rule-line" />
            <div className="rule-emblem">
              <Layers size={28} />
            </div>
            <div className="rule-line" />
          </div>
          <p className="footer-text">Forensic AI System v1.0</p>
        </footer>
      </main>

      {isGenerating && (
        <div className="generation-overlay">
          <div className="scan-line-v2" />
          <div className="loader-content">
            <div className="loader-icon-wrapper">
              <div className="loader-rings" />
              <div className="loader-rings" />
              <div className="loader-rings" />
              <PenTool size={48} className="loader-main-icon" />
            </div>

            <div className="loader-text-group">
              <span className="loader-status">RECONSTRUCTING</span>
              <h2 className="loader-title">Forensic Portrait Analysis</h2>
              <div className="loader-progressbar">
                <div className="loader-progress-fill" />
              </div>
            </div>

            <p className="loader-hint">
              Stabilizing facial markers using custom-trained neural weights.
              Please wait while the Transformer engine reconstructs the suspect.
            </p>
          </div>
        </div>
      )}

      {isConfirming && extractedFeatures && (
        <div className="modal-overlay">
          <div className="modal-container feature-confirmation-modal">
            <div className="modal-panel forensic-panel">
              <div className="panel-corners">
                <div className="corner top-left" />
                <div className="corner top-right" />
                <div className="corner bottom-left" />
                <div className="corner bottom-right" />
              </div>

              <div className="modal-header">
                <span className="panel-number">FR-02</span>
                <h2>Forensic Feature Analysis</h2>
              </div>

              <div className="forensic-table-container">
                <table className="forensic-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedFeatures.features ? (
                      Object.entries(extractedFeatures.features).map(([key, value]) => (
                        <tr key={key}>
                          <td>{key}</td>
                          <td>{value}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" style={{ textAlign: 'center', opacity: 0.5 }}>
                          No specific features identified.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="forensic-note">
                Review the AI's interpretation of your witness statement.
                If accurate, proceed to reconstruction.
              </p>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn secondary"
                  onClick={() => setIsConfirming(false)}
                >
                  <PenTool size={16} style={{ marginRight: '8px' }} />
                  Edit Statement
                </button>
                <button
                  type="button"
                  className="modal-btn primary"
                  onClick={confirmAndGenerate}
                >
                  <CheckCircle size={16} style={{ marginRight: '8px' }} />
                  Begin Reconstruction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ Multi-Image Preview Modal */}
      {isPreviewing && (
        <div className="modal-overlay">
          <div className="modal-container preview-modal">
            <h2 className="modal-title">Select the Best Match</h2>
            <p className="modal-subtitle">Our AI has generated 4 variations. Please pick the one that most closely resembles the suspect's description.</p>

            <div className="preview-grid">
              {previewImages.map((img, idx) => (
                <div
                  key={idx}
                  className={`preview-card ${selectedImageIndex === idx ? 'selected' : ''}`}
                  onClick={() => setSelectedImageIndex(idx)}
                >
                  <img src={img} alt={`Preview ${idx + 1}`} />
                  {selectedImageIndex === idx && (
                    <div className="selection-badge">
                      <CheckCircle size={24} color="white" fill="#3b82f6" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn secondary"
                onClick={() => {
                  setIsPreviewing(false);
                  setIsConfirming(true);
                }}
              >
                BACK
              </button>
              <button
                type="button"
                className="modal-btn primary"
                disabled={selectedImageIndex === null}
                onClick={finalizeSelection}
              >
                <CheckCircle size={16} style={{ marginRight: '8px' }} />
                <span>Finalize & Proceed</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ═══════════════════════════════════════
           DESIGN TOKENS
        ═══════════════════════════════════════ */
        :root {
          --parchment: #F5F0E1;
          --parchment-light: #FAF8F3;
          --parchment-dark: #E8E0CC;
          --ink: #1a1a2e;
          --ink-light: #2d2d44;
          --ink-muted: #4a4a5e;
          --cinnabar: #B33A3A;
          --cinnabar-dark: #8B2323;
          --cinnabar-light: #D64545;
          --indigo: #264653;
          --indigo-light: #2A9D8F;
          --sunflower: #E9C46A;
          --gold: #D4A84B;
          --success-green: #2A9D8F;
          --success-green-dark: #1E7A6D;
          --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --border-thick: 3px;
          --border-thin: 1.5px;
          --radius-sm: 3px;
          --radius-md: 6px;
          --transition-snap: cubic-bezier(0.68, -0.55, 0.265, 1.55);
          --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
          --shadow-soft: 0 4px 20px rgba(26, 26, 46, 0.1);
          --shadow-hard: 4px 4px 0 var(--ink);
        }

        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }

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
                      opacity 0.2s var(--transition-smooth),
                      filter 0.2s var(--transition-smooth);
          opacity: 0.85;
        }

        .crisp-icon.inverted {
          filter: brightness(0) saturate(100%) invert(100%);
          opacity: 0.95;
        }

        /* Size variants */
        .crisp-icon.nav-icon-size {
          width: 22px !important;
          height: 22px !important;
          opacity: 0.6;
        }

        .crisp-icon.mic-stamp-icon {
          width: 28px !important;
          height: 28px !important;
          opacity: 1;
          filter: brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(89%) contrast(97%);
        }

        .crisp-icon.remove-icon-size {
          width: 18px !important;
          height: 18px !important;
        }

        .crisp-icon.cache-delete-icon {
          width: 12px !important;
          height: 12px !important;
          opacity: 0.7;
          filter: brightness(0) saturate(100%);
        }

        /* ═══════════════════════════════════════
           CONTAINER & TEXTURE
        ═══════════════════════════════════════ */
        .neo-edo-container {
          min-height: 100vh;
          background: var(--parchment);
          background-image:
            radial-gradient(ellipse at 20% 50%, rgba(38, 70, 83, 0.03) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(179, 58, 58, 0.03) 0%, transparent 50%);
          position: relative;
          overflow-x: hidden;
          padding: 2rem;
          padding-top: 5.5rem;
        }

        .paper-texture {
          position: fixed; inset: 0; pointer-events: none; opacity: 0.25;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
        }

        .ink-splatter { position: fixed; width: 150px; height: 150px; z-index: 0; pointer-events: none; }
        .ink-splatter.top-left { top: 20px; left: 20px; }
        .ink-splatter.bottom-right { bottom: 20px; right: 20px; }

        /* ═══════════════════════════════════════
           NAVIGATION
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

        .nav-left {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .nav-logo {
          width: 34px; height: 34px;
          background: var(--cinnabar);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(-3deg);
          border: none;
          box-shadow: 2px 2px 0 var(--cinnabar-dark);
        }

        .nav-logo span {
          font-family: var(--font-display);
          font-size: 0.8rem;
          font-weight: 900;
          color: var(--parchment);
          letter-spacing: 0.05em;
        }

        .nav-divider {
          width: 1px;
          height: 20px;
          background: var(--ink);
          opacity: 0.1;
        }

        .nav-title {
          font-family: var(--font-display);
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: 0.2em;
          opacity: 0.35;
          text-transform: uppercase;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .nav-dot {
          width: 3px; height: 3px;
          border-radius: 50%;
          background: var(--ink);
          opacity: 0.12;
          margin: 0 0.15rem;
        }

        /* ═══════════════════════════════════════
           NAV BUTTONS
        ═══════════════════════════════════════ */
        .nav-btn {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.75rem;
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.25s var(--transition-smooth);
          position: relative;
        }

        .nav-btn:hover {
          background: rgba(26, 26, 46, 0.06);
          transform: translateY(-1px);
        }

        .nav-btn:active {
          transform: translateY(0);
          background: rgba(26, 26, 46, 0.1);
        }

        .nav-btn::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          width: 0;
          height: 2px;
          border-radius: 1px;
          transition: all 0.3s var(--transition-smooth);
          transform: translateX(-50%);
        }

        .nav-btn:hover::after { width: 70%; }

        .nav-btn:nth-child(1)::after { background: var(--indigo); }
        .nav-btn:nth-child(3)::after { background: var(--success-green); }
        .nav-btn-logout::after { background: var(--cinnabar) !important; }

        .nav-btn .crisp-icon.nav-icon-size {
          filter: brightness(0) saturate(100%);
        }

        .nav-btn:hover .crisp-icon.nav-icon-size {
          opacity: 1;
        }

        .nav-btn-logout:hover .crisp-icon.nav-icon-size {
          filter: brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(89%) contrast(97%);
          opacity: 1;
        }

        .nav-btn-label {
          font-family: var(--font-body);
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--ink);
          opacity: 0.45;
          letter-spacing: 0.04em;
          transition: all 0.25s;
        }

        .nav-btn:hover .nav-btn-label { opacity: 0.8; }

        .nav-btn-logout:hover {
          background: rgba(179, 58, 58, 0.06);
        }

        .nav-btn-logout:hover .nav-btn-label {
          color: var(--cinnabar);
          opacity: 0.8;
        }

        /* ═══════════════════════════════════════
           FEEDBACK MODAL
        ═══════════════════════════════════════ */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(26, 26, 46, 0.6);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 1rem;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal-container {
          width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto;
          animation: slideUp 0.4s var(--transition-snap);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .modal-panel {
          background: var(--parchment-light);
          border: var(--border-thick) solid var(--ink);
          border-radius: var(--radius-sm);
          padding: 2rem; position: relative;
        }
        .modal-panel::before {
          content: ''; position: absolute; inset: 6px;
          border: var(--border-thin) solid var(--ink);
          border-radius: 1px;
          pointer-events: none; opacity: 0.1;
        }

        .panel-corners .corner {
          position: absolute; width: 15px; height: 15px;
          border-color: var(--cinnabar); border-style: solid; opacity: 0.5;
        }
        .panel-corners .corner.top-left { top: -1px; left: -1px; border-width: 3px 0 0 3px; }
        .panel-corners .corner.top-right { top: -1px; right: -1px; border-width: 3px 3px 0 0; }
        .panel-corners .corner.bottom-left { bottom: -1px; left: -1px; border-width: 0 0 3px 3px; }
        .panel-corners .corner.bottom-right { bottom: -1px; right: -1px; border-width: 0 3px 3px 0; }

        .modal-close-btn {
          position: absolute; top: 1rem; right: 1rem;
          width: 38px; height: 38px;
          background: var(--parchment); border: 2px solid var(--ink);
          border-radius: var(--radius-sm); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s var(--transition-snap); z-index: 10; color: var(--ink);
          padding: 0;
        }

        .modal-close-btn .crisp-icon {
          filter: brightness(0) saturate(100%);
          opacity: 0.7;
        }

        .modal-close-btn:hover {
          background: var(--cinnabar); border-color: var(--cinnabar); color: var(--parchment);
          transform: rotate(90deg);
        }

        .modal-close-btn:hover .crisp-icon {
          filter: brightness(0) saturate(100%) invert(100%);
          opacity: 1;
        }

        .modal-header {
          display: flex; align-items: center; gap: 1rem;
          margin-bottom: 1.5rem; padding-bottom: 0.75rem;
          border-bottom: 2px solid var(--ink); padding-right: 2.5rem;
        }
        .modal-header .panel-number {
          font-family: var(--font-display); font-size: 0.7rem; font-weight: 800;
          color: var(--parchment); background: var(--indigo);
          padding: 0.3rem 0.55rem; letter-spacing: 0.05em;
          border-radius: 2px;
        }
        .modal-header h2 {
          font-family: var(--font-body); font-size: 1rem; font-weight: 700;
          color: var(--ink); letter-spacing: 0.05em; margin: 0;
        }



        .feedback-input-section { margin-bottom: 1.5rem; }
        .feedback-label { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
        .label-text {
          font-size: 0.72rem; font-weight: 700; color: var(--ink);
          letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap;
        }
        .label-line { flex: 1; height: 1px; background: linear-gradient(90deg, var(--ink-muted), transparent); opacity: 0.25; }

        .feedback-textarea {
          width: 100%; padding: 1rem; background: var(--parchment);
          border: 2px solid var(--ink); border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.9rem; color: var(--ink); line-height: 1.6;
          resize: vertical; min-height: 120px; outline: none; transition: all 0.3s;
        }
        .feedback-textarea:focus { border-color: var(--indigo); box-shadow: 0 0 0 3px rgba(38, 70, 83, 0.1); }
        .feedback-textarea::placeholder { color: var(--ink-muted); opacity: 0.5; font-style: italic; }

        .screenshot-section { margin-bottom: 1.5rem; }
        .screenshot-upload-area { position: relative; }
        .screenshot-input { position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2; }
        .screenshot-label {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 1.5rem; background: var(--parchment);
          border: 2px dashed var(--ink-muted); border-radius: var(--radius-sm);
          cursor: pointer; transition: all 0.3s;
        }
        .screenshot-label:hover { border-color: var(--indigo); background: rgba(38, 70, 83, 0.05); }
        .upload-icon { margin-bottom: 0.75rem; color: var(--ink-muted); }
        .upload-text { font-size: 0.85rem; font-weight: 600; color: var(--ink); margin-bottom: 0.25rem; }
        .upload-hint { font-size: 0.7rem; color: var(--ink-muted); }

        .screenshot-preview {
          position: relative; border: 2px solid var(--ink);
          border-radius: var(--radius-sm); overflow: hidden;
        }
        .screenshot-preview img {
          width: 100%; max-height: 200px; object-fit: cover; display: block;
          image-rendering: -webkit-optimize-contrast;
        }
        .remove-screenshot-btn {
          position: absolute; top: 0.5rem; right: 0.5rem;
          width: 34px; height: 34px; background: var(--cinnabar);
          border: 2px solid var(--cinnabar-dark); border-radius: var(--radius-sm);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s var(--transition-snap); color: var(--parchment);
          padding: 0;
        }
        .remove-screenshot-btn:hover { background: var(--cinnabar-dark); transform: scale(1.1); }
        .remove-screenshot-btn:active { transform: scale(0.95); }

        .modal-actions { display: flex; gap: 1rem; justify-content: flex-end; }
        .modal-btn {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.75rem 1.25rem; font-family: var(--font-body);
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
          border: 2px solid var(--ink); border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.25s var(--transition-smooth);
        }
        .modal-btn.secondary { background: transparent; color: var(--ink); }
        .modal-btn.secondary:hover { background: var(--parchment-dark); transform: translateY(-1px); }
        .modal-btn.secondary:active { transform: translateY(0); }
        .modal-btn.primary {
          background: var(--indigo); border-color: var(--indigo); color: var(--parchment);
        }
        .modal-btn.primary:hover:not(:disabled) {
          background: var(--indigo-light); border-color: var(--indigo-light);
          transform: translateY(-2px); box-shadow: 0 3px 0 var(--indigo);
        }
        .modal-btn.primary:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
        .modal-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .modal-btn.primary .crisp-icon.inverted { opacity: 0.9; }
        .modal-btn.primary:hover .crisp-icon.inverted { opacity: 1; }

        .btn-loader {
          width: 14px; height: 14px;
          border: 2px solid var(--parchment); border-top-color: transparent;
          border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .feedback-success {
          display: flex; flex-direction: column; align-items: center; gap: 1rem;
          padding: 3rem 1rem; text-align: center;
        }
        .success-icon {
          width: 80px; height: 80px; background: rgba(42, 157, 143, 0.1);
          border: 3px solid var(--indigo-light); border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          animation: successPop 0.5s var(--transition-snap); color: var(--indigo-light);
        }
        @keyframes successPop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .feedback-success span { font-size: 1.1rem; font-weight: 600; color: var(--ink); }

        /* ═══════════════════════════════════════
           MAIN CONTENT
        ═══════════════════════════════════════ */
        .main-content {
          max-width: 1000px; margin: 0 auto; position: relative; z-index: 1;
          opacity: 0; transform: translateY(20px);
          transition: all 0.8s var(--transition-smooth);
        }
        .main-content.loaded { opacity: 1; transform: translateY(0); }

        .header-section { text-align: center; margin-bottom: 3rem; padding: 2rem 0; }
        .brush-stroke-container { position: relative; display: inline-block; }
        .main-title { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; margin: 0; }
        .title-accent {
          font-family: var(--font-display); font-size: clamp(1rem, 2vw, 1.25rem);
          font-weight: 600; color: var(--cinnabar); letter-spacing: 0.5em; text-transform: uppercase;
        }
        .title-main {
          font-family: var(--font-display); font-size: clamp(2.5rem, 6vw, 4rem);
          font-weight: 900; color: var(--ink); letter-spacing: 0.1em; line-height: 1;
        }
        .title-underline {
          height: 4px;
          background: linear-gradient(90deg, transparent 0%, var(--cinnabar) 20%, var(--cinnabar) 80%, transparent 100%);
          margin-top: 1.5rem; animation: brushStroke 1s var(--transition-snap) forwards;
          transform-origin: left; border-radius: 2px;
        }
        @keyframes brushStroke { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .subtitle {
          font-family: var(--font-body); font-size: 0.9rem; color: var(--ink-muted);
          margin-top: 1.25rem; letter-spacing: 0.05em; font-weight: 500;
        }

        /* ═══════════════════════════════════════
           MANGA GRID
        ═══════════════════════════════════════ */
        .manga-grid { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; margin-bottom: 2rem; }
        @media (max-width: 768px) { .manga-grid { grid-template-columns: 1fr; } }

        .manga-panel {
          background: var(--parchment-light);
          border: var(--border-thick) solid var(--ink);
          border-radius: var(--radius-sm);
          position: relative; padding: 1.5rem;
          transition: all 0.3s var(--transition-smooth);
        }
        .manga-panel::before {
          content: ''; position: absolute; inset: 5px;
          border: var(--border-thin) solid var(--ink);
          border-radius: 1px;
          pointer-events: none; opacity: 0.12;
        }
        .manga-panel:hover { transform: translate(-3px, -3px); box-shadow: var(--shadow-hard); }

        .panel-header {
          display: flex; align-items: center; gap: 1rem;
          margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 2px solid var(--ink);
        }
        .panel-number {
          font-family: var(--font-display); font-size: 0.7rem; font-weight: 800;
          color: var(--parchment); background: var(--ink);
          padding: 0.3rem 0.55rem; letter-spacing: 0.05em; flex-shrink: 0;
          border-radius: 2px;
        }
        .panel-header h2 {
          font-family: var(--font-body); font-size: 0.78rem; font-weight: 700;
          color: var(--ink); letter-spacing: 0.1em; text-transform: uppercase;
          margin: 0; white-space: nowrap;
        }

        /* ═══════════════════════════════════════
           CACHE CONTROLS
        ═══════════════════════════════════════ */
        .panel-header-actions { display: flex; align-items: center; gap: 0.4rem; margin-left: auto; }
        .cache-save-btn, .cache-load-btn {
          width: 32px; height: 32px; background: var(--parchment);
          border: 1.5px solid var(--ink); border-radius: var(--radius-sm); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s var(--transition-smooth);
          color: var(--ink-muted); padding: 0; position: relative;
        }
        .cache-save-btn:hover:not(:disabled) {
          background: var(--indigo); border-color: var(--indigo);
          color: var(--parchment); transform: scale(1.08);
        }
        .cache-save-btn:active:not(:disabled) { transform: scale(0.95); }
        .cache-save-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .cache-save-btn.pulse { animation: savePulseAnim 0.6s var(--transition-snap); }
        @keyframes savePulseAnim {
          0% { transform: scale(1); }
          30% { transform: scale(1.25); background: var(--indigo); color: var(--parchment); border-color: var(--indigo); }
          100% { transform: scale(1); }
        }
        .cache-load-btn:hover {
          background: var(--sunflower); border-color: var(--gold);
          color: var(--ink); transform: scale(1.08);
        }
        .cache-load-btn:active { transform: scale(0.95); }
        .cache-load-btn.has-items { color: var(--ink); }
        .cache-count {
          position: absolute; top: -6px; right: -6px;
          width: 16px; height: 16px; background: var(--cinnabar);
          color: var(--parchment); font-size: 0.55rem; font-weight: 800;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          border: 1.5px solid var(--parchment-light); line-height: 1;
        }

        .cache-dropdown-wrapper { position: relative; }
        .cache-panel {
          position: absolute; top: calc(100% + 8px); right: 0; width: 300px;
          background: var(--parchment-light); border: 2px solid var(--ink);
          border-radius: var(--radius-sm);
          z-index: 50; animation: cacheSlideDown 0.3s var(--transition-snap);
          box-shadow: 6px 6px 0 rgba(26, 26, 46, 0.12);
        }
        .cache-panel::before {
          content: ''; position: absolute; top: -7px; right: 10px;
          width: 12px; height: 12px; background: var(--parchment-light);
          border-left: 2px solid var(--ink); border-top: 2px solid var(--ink);
          transform: rotate(45deg);
        }
        @keyframes cacheSlideDown {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cache-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.65rem 0.85rem; border-bottom: 1.5px solid var(--ink); background: var(--ink);
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
        }
        .cache-panel-title {
          display: flex; align-items: center; gap: 0.4rem;
          font-size: 0.63rem; font-weight: 700; color: var(--parchment);
          letter-spacing: 0.1em; text-transform: uppercase;
        }
        .cache-clear-all {
          background: none; border: 1px solid rgba(255,255,255,0.3);
          color: var(--cinnabar-light); font-size: 0.58rem; font-weight: 600;
          cursor: pointer; padding: 0.2rem 0.5rem; border-radius: 2px;
          transition: all 0.2s; letter-spacing: 0.05em;
        }
        .cache-clear-all:hover { background: var(--cinnabar); color: var(--parchment); border-color: var(--cinnabar); }
        .cache-empty {
          display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
          padding: 1.75rem 1rem; color: var(--ink-muted); opacity: 0.5;
        }
        .cache-empty span { font-size: 0.75rem; font-weight: 500; }
        .cache-list { max-height: 240px; overflow-y: auto; }
        .cache-item {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 0.7rem 0.85rem; background: none; border: none;
          border-bottom: 1px solid var(--parchment-dark); cursor: pointer;
          transition: all 0.15s; text-align: left; gap: 0.5rem;
        }
        .cache-item:last-child { border-bottom: none; }
        .cache-item:hover { background: var(--parchment-dark); }
        .cache-item-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
        .cache-item-text {
          font-family: var(--font-body); font-size: 0.78rem; color: var(--ink);
          font-weight: 500; line-height: 1.3; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }
        .cache-item-time { font-size: 0.58rem; color: var(--ink-muted); font-weight: 500; letter-spacing: 0.03em; }
        .cache-item-actions { display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0; }
        .cache-item-arrow {
          color: var(--ink-muted); opacity: 0; transition: all 0.15s; transform: translateX(-4px);
        }
        .cache-item:hover .cache-item-arrow { opacity: 1; transform: translateX(0); }
        .cache-item-delete {
          width: 22px; height: 22px; background: none; border: 1px solid transparent;
          border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: var(--ink-muted); opacity: 0;
          transition: all 0.15s; padding: 0;
        }
        .cache-item:hover .cache-item-delete { opacity: 1; }
        .cache-item-delete:hover {
          background: var(--cinnabar); border-color: var(--cinnabar); color: var(--parchment);
        }
        .cache-item-delete:hover .crisp-icon.cache-delete-icon {
          filter: brightness(0) saturate(100%) invert(100%);
          opacity: 1;
        }

        /* ═══════════════════════════════════════
           VOICE PANEL
        ═══════════════════════════════════════ */
        .voice-panel { display: flex; flex-direction: column; }
        .voice-visualizer {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 1.5rem; padding: 1rem; min-height: 250px;
        }
        .sound-wave { display: flex; align-items: center; justify-content: center; gap: 8px; height: 60px; }
        .wave-bar {
          width: 6px; height: 20px; background: var(--indigo);
          border-radius: 3px; transition: all 0.15s;
        }
        .sound-wave.active .wave-bar { animation: waveAnimation 0.5s ease-in-out infinite alternate; }
        @keyframes waveAnimation {
          0% { height: 12px; background: var(--indigo); }
          100% { height: 50px; background: var(--cinnabar); }
        }
        .sound-wave.active .wave-bar:nth-child(1) { animation-delay: 0s; }
        .sound-wave.active .wave-bar:nth-child(2) { animation-delay: 0.1s; }
        .sound-wave.active .wave-bar:nth-child(3) { animation-delay: 0.2s; }
        .sound-wave.active .wave-bar:nth-child(4) { animation-delay: 0.1s; }
        .sound-wave.active .wave-bar:nth-child(5) { animation-delay: 0s; }

        .stamp-button {
          width: 110px; height: 110px; border-radius: 50%;
          background: var(--parchment); border: 4px solid var(--cinnabar);
          cursor: pointer; position: relative;
          transition: all 0.3s var(--transition-snap);
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 6px; padding: 0; color: var(--cinnabar);
        }
        .stamp-button::before {
          content: ''; position: absolute; inset: 6px;
          border: 2px solid var(--cinnabar); border-radius: 50%; opacity: 0.4;
        }
        .stamp-button:hover:not(:disabled) {
          transform: scale(1.08) rotate(-5deg);
          box-shadow: 0 6px 25px rgba(179, 58, 58, 0.35);
        }
        .stamp-button:active:not(:disabled) { transform: scale(0.95); }
        .stamp-button.recording {
          background: var(--cinnabar); border-color: var(--cinnabar-dark);
          animation: recordPulse 1.2s infinite; color: var(--parchment);
        }
        .stamp-button.recording .crisp-icon.mic-stamp-icon {
          filter: brightness(0) saturate(100%) invert(100%);
        }
        .stamp-button.recording::before { border-color: var(--parchment); opacity: 0.3; }
        .stamp-button.processing { opacity: 0.7; cursor: not-allowed; animation: glitch 0.3s infinite; }
        @keyframes recordPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(179, 58, 58, 0.5); }
          50% { box-shadow: 0 0 0 18px rgba(179, 58, 58, 0); }
        }
        @keyframes glitch {
          0% { transform: translate(0); } 20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); } 60% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); } 100% { transform: translate(0); }
        }
        .stamp-inner { display: flex; align-items: center; justify-content: center; }
        .stamp-label {
          font-family: var(--font-body); font-size: 0.63rem;
          font-weight: 700; letter-spacing: 0.1em;
        }

        /* ═══════════════════════════════════════
           DESCRIPTION PANEL
        ═══════════════════════════════════════ */
        .description-panel { min-height: 320px; display: flex; flex-direction: column; }
        .scroll-container { position: relative; flex: 1; display: flex; flex-direction: column; }
        .description-input {
          flex: 1; width: 100%; min-height: 200px; padding: 1.25rem;
          background: linear-gradient(to bottom, var(--parchment-dark) 0%, var(--parchment) 3%, var(--parchment) 97%, var(--parchment-dark) 100%);
          border: 2px solid var(--ink); border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.95rem; color: var(--ink); line-height: 1.9;
          resize: none; outline: none; transition: all 0.3s;
        }
        .description-input:focus { border-color: var(--indigo); box-shadow: inset 0 0 30px rgba(38, 70, 83, 0.08); }
        .description-input::placeholder { color: var(--ink-muted); opacity: 0.5; font-style: italic; }
        .scroll-decoration {
          position: absolute; left: 50%; transform: translateX(-50%); width: 50%; height: 6px;
          background: linear-gradient(90deg, transparent, var(--sunflower) 25%, var(--gold) 50%, var(--sunflower) 75%, transparent);
          border-radius: 3px;
        }
        .scroll-decoration.top { top: -10px; }
        .scroll-decoration.bottom { bottom: -10px; }

        /* ═══════════════════════════════════════
           PREVIEW PANEL
        ═══════════════════════════════════════ */
        .preview-panel {
          margin-top: 1.5rem;
          padding: 1rem;
          animation: slideInUp 0.6s var(--transition-snap) both;
        }
        .recent-sketch-container {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        .sketch-frame.mini {
          width: 100px;
          height: 100px;
          border: 2px solid var(--ink);
          border-radius: 4px;
          overflow: hidden;
        }
        .preview-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }
        .preview-btn {
          padding: 0.5rem 1rem;
          font-size: 0.65rem;
          font-weight: 800;
          background: var(--ink);
          color: var(--parchment);
          border: none;
          cursor: pointer;
          border-radius: 2px;
          transition: 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .preview-btn.secondary {
          background: transparent;
          color: var(--ink-muted);
          border: 1px solid var(--ink-muted);
        }
        .preview-btn:hover {
          transform: translateY(-2px);
          box-shadow: 2px 2px 0 var(--ink-muted);
        }

        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ═══════════════════════════════════════
           STYLE SELECTOR
        ═══════════════════════════════════════ */
        .style-selector-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
          margin-top: -1rem;
        }
        .style-label {
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--cinnabar);
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .style-toggle-group {
          display: flex;
          background: var(--parchment-dark);
          padding: 4px;
          border-radius: var(--radius-md);
          border: 2px solid var(--ink);
        }
        .style-toggle-btn {
          padding: 0.6rem 1.25rem;
          font-family: var(--font-display);
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          cursor: pointer;
          transition: all 0.3s;
          border-radius: var(--radius-sm);
        }
        .style-toggle-btn.active {
          background: var(--ink);
          color: var(--parchment);
          box-shadow: 2px 2px 0 rgba(0,0,0,0.1);
        }
        .style-toggle-btn:hover:not(.active) {
          background: rgba(26, 26, 46, 0.05);
          color: var(--ink);
        }

        /* ═══════════════════════════════════════
           ACTION BAR
        ═══════════════════════════════════════ */
        .action-bar { display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap; margin-top: 3.5rem; perspective: 1000px; }
        .action-button {
          display: flex; align-items: center; gap: 0.8rem;
          padding: 1.1rem 2rem; background: var(--parchment);
          border: var(--border-thick) solid var(--ink);
          border-radius: var(--radius-sm);
          font-family: var(--font-display); font-size: 0.85rem; font-weight: 800;
          letter-spacing: 0.15em; color: var(--ink); cursor: pointer;
          position: relative; overflow: hidden;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          text-transform: uppercase;
          box-shadow: 6px 6px 0 var(--ink);
        }
        .action-button::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(45deg, transparent, rgba(233, 196, 106, 0.1), transparent);
          transform: translateX(-100%); transition: transform 0.6s;
        }
        .action-button:hover::before { transform: translateX(100%); }
        .action-button:hover { transform: translate(-3px, -3px); box-shadow: 9px 9px 0 var(--ink); }
        .action-button:active { transform: translate(0, 0); box-shadow: 2px 2px 0 var(--ink); }
        .action-button.primary { 
          background: var(--ink); color: var(--parchment);
          border-color: var(--ink);
        }
        .action-button.primary:hover { 
          background: var(--ink-light); 
          color: var(--sunflower);
        }
        .action-button.primary .btn-icon { color: var(--sunflower); transition: transform 0.3s; }
        .action-button.primary:hover .btn-icon { transform: rotate(15deg) scale(1.2); }
        .action-button:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
        .btn-icon { width: 22px; height: 22px; flex-shrink: 0; }

        /* ═══════════════════════════════════════
           HERO SECTION
        ═══════════════════════════════════════ */
        .hero-banner { 
          position: relative; padding: 5rem 1rem; margin-bottom: 4rem; 
          text-align: center; border-bottom: 2px solid var(--ink);
          overflow: hidden;
          background: radial-gradient(circle at 50% 50%, rgba(38, 70, 83, 0.05) 0%, transparent 70%);
        }
        .hero-content { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; }
        .hero-subtitle { 
          font-family: var(--font-body); font-size: 1.1rem; color: var(--ink-muted);
          margin: 1.5rem auto 2.5rem; line-height: 1.6; max-width: 600px;
          font-weight: 500;
        }
        .hero-cta { margin-top: 2rem; display: flex; justify-content: center; }
        .cta-button {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 1rem 2rem; background: var(--cinnabar);
          color: white; font-weight: 800; font-size: 0.9rem;
          text-transform: uppercase; letter-spacing: 0.1em;
          border-radius: var(--radius-sm); border: 3px solid var(--cinnabar-dark);
          transition: all 0.3s var(--transition-bounce);
          box-shadow: 0 4px 15px rgba(179, 58, 58, 0.3);
        }
        .cta-button:hover {
          transform: translateY(-4px) scale(1.02);
          background: var(--cinnabar-light);
          box-shadow: 0 8px 25px rgba(179, 58, 58, 0.4);
        }
        .premium-pulse {
          animation: premiumPulse 2s infinite;
          background: var(--ink) !important;
          color: var(--sunflower) !important;
          border-color: var(--sunflower) !important;
        }
        @keyframes premiumPulse {
          0% { box-shadow: 0 0 0 0 rgba(233, 196, 106, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(233, 196, 106, 0); }
          100% { box-shadow: 0 0 0 0 rgba(233, 196, 106, 0); }
        }

        /* ═══════════════════════════════════════
           FOOTER
        ═══════════════════════════════════════ */
        .footer-decoration { margin-top: 3.5rem; padding-top: 2rem; text-align: center; }
        .horizontal-rule {
          display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-bottom: 1rem;
        }
        .rule-line {
          flex: 1; max-width: 120px; height: 2px;
          background: linear-gradient(90deg, transparent, var(--ink-muted) 50%, transparent);
          opacity: 0.25;
        }
        .rule-emblem { color: var(--cinnabar); opacity: 0.4; }
        .footer-text {
          font-family: var(--font-body); font-size: 0.68rem; color: var(--ink-muted);
          letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.4; margin: 0;
        }

        /* ═══════════════════════════════════════
           LOADING OVERLAY
        ═══════════════════════════════════════ */
        .generation-overlay {
          position: fixed; inset: 0;
          background: rgba(15, 15, 25, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          z-index: 2000; padding: 2rem;
          animation: overlayFadeIn 0.5s ease;
          color: var(--parchment);
          text-align: center;
        }
        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .loader-content {
          position: relative;
          display: flex; flex-direction: column; align-items: center;
          gap: 2.5rem; max-width: 400px;
        }

        .loader-icon-wrapper {
          position: relative;
          width: 100px; height: 100px;
          display: flex; align-items: center; justify-content: center;
        }

        .loader-rings {
          position: absolute; inset: -20px;
          border: 2px solid var(--cinnabar);
          border-radius: 50%; opacity: 0.15;
          animation: ringPulse 2s infinite ease-out;
        }
        .loader-rings:nth-child(2) { animation-delay: 0.6s; }
        .loader-rings:nth-child(3) { animation-delay: 1.2s; }

        @keyframes ringPulse {
          0% { transform: scale(0.5); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        .loader-main-icon {
          color: var(--parchment);
          filter: drop-shadow(0 0 10px rgba(245, 240, 225, 0.3));
          animation: iconFloat 3s infinite ease-in-out;
        }
        @keyframes iconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .loader-text-group {
          display: flex; flex-direction: column; gap: 0.75rem;
        }

        .loader-status {
          font-family: var(--font-display);
          font-size: 0.8rem; font-weight: 800;
          letter-spacing: 0.3em; color: var(--cinnabar);
          text-transform: uppercase;
          animation: statusPulse 1.5s infinite;
        }
        @keyframes statusPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .loader-title {
          font-family: var(--font-body);
          font-size: 1.2rem; font-weight: 700;
          letter-spacing: 0.05em; color: var(--parchment);
        }

        .loader-progressbar {
          width: 240px; height: 4px;
          background: rgba(245, 240, 225, 0.1);
          border-radius: 2px; overflow: hidden;
          position: relative;
        }
        .loader-progress-fill {
          position: absolute; top: 0; left: 0; height: 100%;
          width: 40%; background: var(--cinnabar);
          animation: progressMove 2s infinite ease-in-out;
        }
        @keyframes progressMove {
          0% { left: -40%; }
          100% { left: 100%; }
        }

        .loader-hint {
          font-family: var(--font-body);
          font-size: 0.7rem; color: var(--parchment);
          opacity: 0.5; line-height: 1.6;
          font-style: italic; max-width: 280px;
        }

        .scan-line-v2 {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, transparent, rgba(179, 58, 58, 0.1), transparent);
          height: 100px; width: 100%;
          animation: scanV2 3s linear infinite;
          pointer-events: none;
        }
        @keyframes scanV2 { from { top: -100px; } to { top: 100%; } }

        /* ═══════════════════════════════════════
           MODALS
        ═══════════════════════════════════════ */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 3000; padding: 1.5rem;
          animation: overlayFadeIn 0.3s ease;
        }

        .modal-container {
          background: var(--parchment);
          border: var(--border-thick) solid var(--ink);
          border-radius: var(--radius-sm);
          padding: 2.5rem;
          max-width: 600px; width: 100%;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 10px 10px 0 var(--ink);
          position: relative;
        }

        .modal-title {
          font-family: var(--font-display);
          font-size: 1.5rem; font-weight: 900;
          color: var(--ink); margin-bottom: 0.5rem;
          text-transform: uppercase; letter-spacing: 0.05em;
        }

        .modal-subtitle {
          font-family: var(--font-body);
          font-size: 0.85rem; color: var(--ink-muted);
          margin-bottom: 2rem;
        }

        .modal-actions {
          display: flex; justify-content: flex-end; gap: 1rem;
          margin-top: 2rem;
        }

        .modal-btn {
          display: flex; align-items: center; justify-content: center;
          padding: 0.75rem 1.5rem; border-radius: var(--radius-sm);
          font-family: var(--font-body); font-size: 0.8rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s; border: var(--border-thick) solid var(--ink);
        }

        .modal-btn.primary { background: var(--ink); color: var(--parchment); }
        .modal-btn.primary:hover { background: var(--cinnabar); border-color: var(--cinnabar); color: white; }
        .modal-btn.secondary { background: transparent; color: var(--ink); }
        .modal-btn.secondary:hover { background: rgba(0,0,0,0.05); }
        .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Preview Modal Specifics */
        .preview-modal {
          max-width: 900px !important;
          width: 95% !important;
        }

        .preview-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin: 1.5rem 0;
        }

        .preview-card {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          border: 3px solid transparent;
          transition: all 0.2s ease;
          background: #111827;
          aspect-ratio: 1;
        }

        .preview-card:hover {
          transform: translateY(-5px);
          border-color: #4b5563;
        }

        .preview-card.selected {
          border-color: #3b82f6;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
        }

        .preview-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .selection-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #3b82f6;
          color: white;
          padding: 4px;
          border-radius: 50%;
          box-shadow: 0 2px 10px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ═══════════════════════════════════════
           RESPONSIVE
        ═══════════════════════════════════════ */
        @media (max-width: 600px) {
          .neo-edo-container { padding: 1rem; padding-top: 4.5rem; }
          .top-nav { padding: 0 1rem; height: 50px; }
          .nav-logo { width: 28px; height: 28px; }
          .nav-logo span { font-size: 0.65rem; }
          .nav-title { display: none; }
          .nav-divider { display: none; }
          .nav-btn { padding: 0.35rem 0.5rem; }
          .nav-btn-label { display: none; }
          .nav-dot { display: none; }

          .crisp-icon { width: 18px !important; height: 18px !important; }
          .crisp-icon.nav-icon-size { width: 20px !important; height: 20px !important; }
          .crisp-icon.mic-stamp-icon { width: 24px !important; height: 24px !important; }
          .crisp-icon.cache-delete-icon { width: 11px !important; height: 11px !important; }
 
          .manga-panel { padding: 1rem; }
          .voice-visualizer { min-height: 200px; gap: 1rem; }
          .stamp-button { width: 90px; height: 90px; }
          .action-button { padding: 0.75rem 1rem; font-size: 0.7rem; }
          .action-bar { gap: 0.75rem; }
          .btn-icon { width: 16px; height: 16px; }
          .description-input { min-height: 150px; font-size: 0.9rem; }
          .modal-panel { padding: 1.5rem; }
          .modal-actions { flex-direction: column; }
          .modal-btn { width: 100%; justify-content: center; }

          .cache-panel { width: 260px; right: -40px; }
          .panel-header { flex-wrap: wrap; gap: 0.5rem; }
          .panel-header-actions { margin-left: 0; order: 3; width: 100%; justify-content: flex-end; }
        }

        /* ═══════════════════════════════════════
           UTILITIES
        ═══════════════════════════════════════ */
        /* ═══════════════════════════════════════
           FORENSIC TABLE
        ═══════════════════════════════════════ */
        .feature-confirmation-modal { max-width: 600px; }
        .forensic-panel { border-color: var(--indigo); }
        .forensic-table-container { 
          margin: 1.5rem 0; 
          border: 2px solid var(--ink);
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--parchment);
        }
        .forensic-table {
          width: 100%; border-collapse: collapse;
          font-family: var(--font-body); font-size: 0.85rem;
        }
        .forensic-table th {
          background: var(--ink); color: var(--parchment);
          text-align: left; padding: 0.75rem 1rem;
          text-transform: uppercase; letter-spacing: 0.1em;
          font-size: 0.7rem; font-weight: 800;
        }
        .forensic-table td {
          padding: 0.75rem 1rem; border-bottom: 1px solid rgba(26,26,46,0.1);
          line-height: 1.4; color: var(--ink);
        }
        .forensic-table tr:last-child td { border-bottom: none; }
        .forensic-table td:first-child {
          font-weight: 700; width: 30%;
          background: rgba(26,26,46,0.03);
          border-right: 1px solid rgba(26,26,46,0.1);
          text-transform: uppercase; font-size: 0.65rem; color: var(--indigo);
        }
        .forensic-note {
          font-size: 0.7rem; color: var(--ink-muted);
          font-style: italic; margin-bottom: 1.5rem;
          text-align: center; opacity: 0.8;
        }
        /* ═══════════════════════════════════════
           LOGIN GATE MODAL
        ═══════════════════════════════════════ */
        .login-gate-modal {
          max-width: 480px;
          text-align: center;
          animation: modalSlideUp 0.4s var(--transition-snap);
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .gate-content {
          padding: 1rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .gate-icon-wrapper {
          position: relative;
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.5rem;
        }
        .gate-main-icon {
          color: var(--cinnabar);
          z-index: 2;
        }
        .gate-rings {
          position: absolute;
          inset: 0;
          z-index: 1;
        }
        .gate-rings .ring {
          position: absolute;
          inset: 0;
          border: 2px solid var(--cinnabar);
          border-radius: 50%;
          opacity: 0.2;
          animation: gateRingPulse 2s infinite ease-out;
        }
        .gate-rings .ring:nth-child(2) {
          animation-delay: 1s;
        }
        @keyframes gateRingPulse {
          0% { transform: scale(0.8); opacity: 0.4; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .gate-text {
          font-family: var(--font-body);
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--ink);
          margin: 0;
        }
        .gate-text b, .gate-text strong {
          color: var(--cinnabar);
          font-weight: 700;
        }
        .gate-features {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 0.75rem;
          width: 100%;
          background: rgba(38, 70, 83, 0.05);
          padding: 1.25rem;
          border-radius: var(--radius-sm);
          border: 1px dashed var(--indigo);
        }
        .gate-feature {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--indigo);
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .login-gate-modal .modal-actions {
          margin-top: 1.5rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 480px) {
          .login-gate-modal .modal-actions {
            grid-template-columns: 1fr;
          }
        }
        .action-bar-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
        }
        .guest-notice {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--cinnabar);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: rgba(179, 58, 58, 0.05);
          padding: 0.4rem 0.8rem;
          border-radius: 20px;
          border: 1px solid rgba(179, 58, 58, 0.2);
          animation: noticeFadeIn 0.5s ease-out;
        }
        @keyframes noticeFadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .action-button.guest-lock {
          background: var(--ink);
          color: var(--paper);
          border-color: var(--ink);
        }
        .action-button.guest-lock:hover {
          background: #000;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .investigator-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #2a9d8f;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: rgba(42, 157, 143, 0.05);
          padding: 0.4rem 0.8rem;
          border-radius: 20px;
          border: 1px solid rgba(42, 157, 143, 0.2);
          animation: noticeFadeIn 0.5s ease-out;
        }
        .ready-pulse {
          animation: buttonReadyPulse 2s infinite;
          box-shadow: 0 0 15px rgba(179, 58, 58, 0.3);
        }
        @keyframes buttonReadyPulse {
          0% { box-shadow: 0 0 10px rgba(179, 58, 58, 0.3); }
          50% { box-shadow: 0 0 25px rgba(179, 58, 58, 0.6); }
          100% { box-shadow: 0 0 10px rgba(179, 58, 58, 0.3); }
        }
      `}</style>
    </div>
  );
}

export default HomePage;