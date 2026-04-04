// src/AdminHomeScreen.js
// ═══════════════════════════════════════════════════════════════════════════════
//  ADMINISTRATIVE COMMAND CENTER - FACE TRACE SYSTEM
//  "The architect oversees the blueprint of the chaos."
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { db, storage } from "./firebaseConfig";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import saveIcon from "./assets/save.png";

export default function AdminHomeScreen() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [showDatasetPopup, setShowDatasetPopup] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemPulse, setSystemPulse] = useState(0);
  const canvasRef = useRef(null);

  // Toast notification state
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" });
  const toastTimer = useRef(null);

  const adminId = "default_admin";

  const [culprit, setCulprit] = useState({
    name: "",
    age: "",
    gender: "",
    notes: "",
  });
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [stats] = useState({
    datasets: 3,
    totalFaces: 1910,
    activeCases: 12,
    lastMatchScore: 0.87,
    systemStatus: "OPERATIONAL",
    threatLevel: "LOW",
    processingQueue: 3,
    lastSync: "2 min ago",
  });

  // Toast notification helper
  const showToast = useCallback((message, type = "info") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, type });
    toastTimer.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setSystemPulse((prev) => (prev + 1) % 100);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Canvas background animation
  useEffect(() => {
    setLoaded(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticle = () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.5 + 0.1,
    });

    const init = () => {
      resize();
      particles = Array.from({ length: 50 }, createParticle);
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(179, 58, 58, ${p.opacity})`;
        ctx.fill();
      });

      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(38, 70, 83, ${0.1 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };

    init();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Age input handler — clamp between 1 and 120, block negatives
  const handleAgeChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setCulprit({ ...culprit, age: "" });
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 120) {
      setCulprit({ ...culprit, age: String(parsed) });
    }
  };

  const handleAgeKeyDown = (e) => {
    if (["-", "+", "e", "E", "."].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleSaveDataset = async () => {
    if (images.length < 3) {
      setError("Minimum 3 images required for facial recognition");
      return;
    }

    if (!culprit.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setUploading(true);
      setError("");

      const urls = [];

      for (const img of images) {
        const imageRef = ref(
          storage,
          `admin/${adminId}/faces/${culprit.name}/${Date.now()}_${img.name}`
        );

        await uploadBytes(imageRef, img);
        const downloadURL = await getDownloadURL(imageRef);
        urls.push(downloadURL);
      }

      const formData = new FormData();
      formData.append("name", culprit.name);

      urls.forEach((url) => {
        formData.append("image_urls", url);
      });

      const response = await fetch("http://127.0.0.1:5000/api/enroll", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Embedding generation failed");
      }

      const datasetRef = collection(db, "admin", adminId, "datasets");

      await addDoc(datasetRef, {
        datasetId: Date.now().toString(),
        culprit: {
          name: culprit.name,
          age: culprit.age,
          gender: culprit.gender,
          notes: culprit.notes,
        },
        imageUrls: urls,
        embeddingCount: data.embeddings_added,
        createdAt: new Date(),
      });

      setShowDatasetPopup(false);
      setImages([]);
      setCulprit({ name: "", age: "", gender: "", notes: "" });

      showToast("Record enrolled successfully", "success");
    } catch (err) {
      console.error("Enrollment Error:", err);
      setError("Enrollment failed. Check backend server.");
    } finally {
      setUploading(false);
    }
  };

  // ═══════════════════════════════════
  //  VISIBLE MENU ITEMS (02, 04, 05, XX)
  //  Operations 01 (Sketch Generator) and 03 (Face Matching) are hidden
  // ═══════════════════════════════════
  const menuItems = [
    {
      id: "dataset",
      number: "01",
      title: "Dataset Manager",
      subtitle: "Criminal Records",
      description: "Upload and manage facial recognition database entries",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M3 15h6" />
          <path d="M6 12v6" />
        </svg>
      ),
      action: () => setShowDatasetPopup(true),
      accent: "indigo",
      featured: true,
    },
    {
      id: "cases",
      number: "02",
      title: "Case Files",
      subtitle: "Active Investigations",
      description: "Manage ongoing criminal investigations and evidence",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      ),
      action: () => showToast("Case Files module is under development", "info"),
      accent: "gold",
    },
    {
      id: "logs",
      number: "03",
      title: "System Logs",
      subtitle: "Audit Trail",
      description: "Monitor system access and operation history",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      route: "/admin/users",
      accent: "muted",
    },
    {
      id: "logout",
      number: "XX",
      title: "Terminate Session",
      subtitle: "Secure Logout",
      description: "End current administrative session securely",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
      route: "/",
      accent: "danger",
    },
  ];

  // ═══════════════════════════════════
  //  Dataset Modal — rendered via portal
  // ═══════════════════════════════════
  const datasetModal = showDatasetPopup
    ? createPortal(
      <div className="modal-overlay" onClick={() => setShowDatasetPopup(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-corners">
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
          </div>

          {/* Modal Header */}
          <div className="modal-header">
            <div className="modal-title-group">
              <div className="modal-hanko">
                <span>NEW</span>
              </div>
              <div className="modal-titles">
                <span className="modal-subtitle-text">DATABASE ENTRY</span>
                <h2 className="modal-title-text">Add Criminal Record</h2>
              </div>
            </div>

            <button
              className="modal-close"
              onClick={() => setShowDatasetPopup(false)}
              aria-label="Close"
            >
              <span className="close-x">×</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="modal-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <div className="modal-form">
            <div className="form-section">
              <div className="section-label">
                <span className="label-number">01</span>
                <span>Subject Information</span>
              </div>

              <div className="input-group full">
                <label>Full Name</label>
                <input
                  type="text"
                  className="neo-input"
                  placeholder="Enter subject's full name"
                  value={culprit.name}
                  onChange={(e) =>
                    setCulprit({ ...culprit, name: e.target.value })
                  }
                />
              </div>

              <div className="input-row">
                <div className="input-group">
                  <label>Age</label>
                  <input
                    type="number"
                    className="neo-input"
                    placeholder="Est. age"
                    min="1"
                    max="120"
                    value={culprit.age}
                    onChange={handleAgeChange}
                    onKeyDown={handleAgeKeyDown}
                  />
                </div>

                <div className="input-group">
                  <label>Gender</label>
                  <div className="select-wrapper">
                    <select
                      className="neo-select"
                      value={culprit.gender}
                      onChange={(e) =>
                        setCulprit({ ...culprit, gender: e.target.value })
                      }
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="input-group full">
                <label>Distinguishing Features</label>
                <textarea
                  className="neo-textarea"
                  placeholder="Scars, tattoos, birthmarks, or other identifying features..."
                  value={culprit.notes}
                  onChange={(e) =>
                    setCulprit({ ...culprit, notes: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="form-section">
              <div className="section-label">
                <span className="label-number">02</span>
                <span>Facial Images</span>
              </div>

              <div className="upload-zone">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  id="file-upload"
                  className="file-input"
                  onChange={(e) => setImages([...e.target.files])}
                />
                <label htmlFor="file-upload" className="upload-label">
                  <div className="upload-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="upload-text">
                    <span className="upload-main">
                      {images.length > 0
                        ? `${images.length} file${images.length > 1 ? "s" : ""} selected`
                        : "Drop files or click to upload"}
                    </span>
                    <span className="upload-hint">
                      Minimum 3 images required (JPG, PNG)
                    </span>
                  </div>
                </label>

                {images.length > 0 && (
                  <div className="upload-preview">
                    {Array.from(images).map((img, i) => (
                      <div key={i} className="preview-item">
                        <img
                          src={URL.createObjectURL(img)}
                          alt={`Preview ${i + 1}`}
                        />
                        <span className="preview-name">{img.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="modal-actions">
            <button
              className="action-btn secondary"
              onClick={() => setShowDatasetPopup(false)}
            >
              <span>CANCEL</span>
            </button>
            <button
              className="action-btn primary"
              disabled={uploading}
              onClick={handleSaveDataset}
            >
              {uploading ? (
                <>
                  <span className="spinner" />
                  <span>PROCESSING...</span>
                </>
              ) : (
                <>
                  <img
                    src={saveIcon}
                    alt="Save"
                    className="crisp-icon inverted"
                  />
                  <span>SAVE RECORD</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <div className="admin-container">
      {/* Animated Background Canvas */}
      <canvas ref={canvasRef} className="bg-canvas" />

      {/* Radial Background Washes */}
      <div className="bg-wash wash-indigo" />
      <div className="bg-wash wash-cinnabar" />

      {/* Paper Texture */}
      <div className="paper-texture" />

      {/* Scan Lines Effect */}
      <div className="scan-lines" />

      {/* Corner Decorations */}
      <div className="corner-decor top-left">
        <svg viewBox="0 0 100 100">
          <path d="M0 30 L0 0 L30 0" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="0" cy="0" r="4" fill="currentColor" />
        </svg>
      </div>
      <div className="corner-decor top-right">
        <svg viewBox="0 0 100 100">
          <path d="M70 0 L100 0 L100 30" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="0" r="4" fill="currentColor" />
        </svg>
      </div>
      <div className="corner-decor bottom-left">
        <svg viewBox="0 0 100 100">
          <path d="M0 70 L0 100 L30 100" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="0" cy="100" r="4" fill="currentColor" />
        </svg>
      </div>
      <div className="corner-decor bottom-right">
        <svg viewBox="0 0 100 100">
          <path d="M100 70 L100 100 L70 100" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="100" r="4" fill="currentColor" />
        </svg>
      </div>

      {/* ═══ Toast Notification ═══ */}
      <div className={`toast-container ${toast.visible ? "visible" : ""} ${toast.type}`}>
        <div className="toast-icon">
          {toast.type === "success" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <span className="toast-message">{toast.message}</span>
        <button
          className="toast-dismiss"
          onClick={() => setToast((p) => ({ ...p, visible: false }))}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className={`main-wrapper ${loaded ? "loaded" : ""}`}>
        {/* Top Bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            <div className="system-id">
              <div className="hanko-mini">
                <span>FT</span>
              </div>
              <div className="system-info">
                <span className="system-label">FACE TRACE</span>
                <span className="system-version">ADMIN TERMINAL v2.4.1</span>
              </div>
            </div>
          </div>

          <div className="top-bar-center">
            <div className="time-display">
              <span className="time-value">
                {currentTime.toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="date-value">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="top-bar-right">
            <div className="status-beacon">
              <span className="beacon-dot" />
              <span className="beacon-label">SYSTEM ACTIVE</span>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">◆</span>
              <span>ADMINISTRATIVE ACCESS GRANTED</span>
              <span className="badge-icon">◆</span>
            </div>

            <h1 className="hero-title">
              <span className="title-line">
                <span className="title-brush" />
                <span className="title-text">COMMAND</span>
              </span>
              <span className="title-line main">
                <span className="title-text">CENTER</span>
                <span className="title-brush right" />
              </span>
            </h1>

            <p className="hero-subtitle">
              Forensic Facial Recognition &amp; Criminal Identification System
            </p>

            <div className="hero-stats">
              <div className="stat-card">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-value">{stats.totalFaces.toLocaleString()}</span>
                  <span className="stat-label">RECORDS</span>
                </div>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: "78%" }} />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon accent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-value">{stats.activeCases}</span>
                  <span className="stat-label">ACTIVE CASES</span>
                </div>
                <div className="stat-bar">
                  <div className="stat-fill accent" style={{ width: "45%" }} />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon gold">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-value">
                    {(stats.lastMatchScore * 100).toFixed(0)}%
                  </span>
                  <span className="stat-label">ACCURACY</span>
                </div>
                <div className="stat-bar">
                  <div
                    className="stat-fill gold"
                    style={{ width: `${stats.lastMatchScore * 100}%` }}
                  />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div className="stat-content">
                  <span className="stat-value">{stats.processingQueue}</span>
                  <span className="stat-label">IN QUEUE</span>
                </div>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: "20%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="hero-decoration">
            <div className="deco-circle outer">
              <div className="deco-circle middle">
                <div className="deco-circle inner">
                  <div className="deco-core">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="orbit-ring ring1">
              <div className="orbit-dot" />
            </div>
            <div className="orbit-ring ring2">
              <div className="orbit-dot" />
            </div>
          </div>
        </section>

        {/* Navigation Grid */}
        <section className="nav-grid">
          <div className="section-header">
            <div className="header-line" />
            <h2>
              <span className="header-number">00</span>
              OPERATIONS MENU
            </h2>
            <div className="header-line" />
          </div>

          <div className="cards-container">
            {menuItems.map((item, index) => (
              <div
                key={item.id}
                className={`nav-card ${item.accent} ${item.featured ? "featured" : ""
                  } ${activeCard === item.id ? "active" : ""}`}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else if (item.route) {
                    navigate(item.route);
                  }
                }}
                onMouseEnter={() => setActiveCard(item.id)}
                onMouseLeave={() => setActiveCard(null)}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="card-pattern">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <pattern
                      id={`grid-${item.id}`}
                      width="10"
                      height="10"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 10 0 L 0 0 0 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.3"
                      />
                    </pattern>
                    <rect width="100" height="100" fill={`url(#grid-${item.id})`} />
                  </svg>
                </div>

                <div className="card-corners">
                  <span className="corner tl" />
                  <span className="corner tr" />
                  <span className="corner bl" />
                  <span className="corner br" />
                </div>

                <div className="card-header">
                  <span className="card-number">{item.number}</span>
                  <div className="card-icon">{item.icon}</div>
                </div>

                <div className="card-body">
                  <h3 className="card-title">{item.title}</h3>
                  <span className="card-subtitle">{item.subtitle}</span>
                  <p className="card-desc">{item.description}</p>
                </div>

                <div className="card-footer">
                  <span className="card-action">
                    {item.id === "logout" ? "TERMINATE" : "ACCESS"}
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>

                <div className="card-glow" />
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="admin-footer">
          <div className="footer-content">
            <div className="footer-left">
              <span className="footer-label">SESSION ID:</span>
              <span className="footer-value">
                ADM-{Date.now().toString(36).toUpperCase()}
              </span>
            </div>
            <div className="footer-center">
              <div className="pulse-bar">
                {[...Array(20)].map((_, i) => (
                  <span
                    key={i}
                    className="pulse-segment"
                    style={{
                      height: `${Math.sin((systemPulse + i * 5) * 0.1) * 50 + 50}%`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="footer-right">
              <span className="footer-label">LAST SYNC:</span>
              <span className="footer-value">{stats.lastSync}</span>
            </div>
          </div>
        </footer>

        {/* ═══ IMMERSIVE OVERLAY ═══ */}
        {uploading && (
          <div className="immersive-loader-overlay">
            <div className="scan-line-v2" />
            <div className="loader-content-v2">
              <div className="loader-visual-v2">
                <div className="pulse-ring-v2" />
                <div className="pulse-ring-v2" />
                <div className="pulse-ring-v2" />
                <div className="central-icon-v2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="loader-svg">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                </div>
              </div>

              <div className="loader-text-v2">
                <span className="loader-status-v2">ENROLLING SUSPECT</span>
                <h2 className="loader-title-v2">Generating Biometric Embeddings</h2>
                <div className="loader-progress-v2">
                  <div className="progress-fill-v2" />
                </div>
              </div>

              <p className="loader-hint-v2">
                Analyzing facial landmarks across multiple angles.
                Securing suspect profile in the forensic database.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Dataset Modal — portaled to document.body ═══ */}
      {datasetModal}

      <style>{`
        /* ═══════════════════════════════════════
           NEO-EDO ADMIN COMMAND CENTER
           Enhanced UI — crisp-icon system + polish
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
          --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

          --radius-sm: 3px;
          --radius-md: 5px;

          --transition-snap: cubic-bezier(0.68, -0.55, 0.265, 1.55);
          --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);

          --shadow-hard: 4px 4px 0 var(--ink);
          --shadow-hover: 0 6px 24px rgba(26, 26, 46, 0.13);
          --shadow-btn: 0 4px 12px rgba(26, 26, 46, 0.15);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ═══════════════════════════════════════
           CRISP-ICON UNIFIED CLASS SYSTEM
        ═══════════════════════════════════════ */

        .crisp-icon {
          width: 20px !important;
          height: 20px !important;
          object-fit: contain !important;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          background: transparent !important;
          padding: 0 !important;
          border: none !important;
          display: block;
          flex-shrink: 0;

          -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50'/%3E%3C/svg%3E");
          mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50'/%3E%3C/svg%3E");
          -webkit-mask-size: contain;
          mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-position: center;
          mask-position: center;

          transition: transform 0.25s var(--transition-smooth),
                      opacity 0.25s var(--transition-smooth),
                      filter 0.25s var(--transition-smooth);
        }

        .crisp-icon.inverted {
          filter: invert(100%) !important;
        }

        .crisp-icon.action-icon-dark {
          filter: brightness(0) !important;
        }

        .crisp-icon.no-mask {
          -webkit-mask-image: none !important;
          mask-image: none !important;
        }

        .modal-close:hover .crisp-icon.action-icon-dark {
          filter: invert(100%) !important;
        }

        .crisp-icon.entry-icon-sm {
          width: 14px !important;
          height: 14px !important;
        }

        .crisp-icon.icon-md {
          width: 24px !important;
          height: 24px !important;
        }

        /* ═══════════════════════════════════════
           TOAST NOTIFICATION
        ═══════════════════════════════════════ */

        .toast-container {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%) translateY(120%);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.9rem 1.25rem;
          background: var(--ink);
          color: var(--parchment);
          border: 2px solid var(--ink-light);
          border-radius: var(--radius-md);
          box-shadow: 0 10px 40px rgba(26, 26, 46, 0.35);
          z-index: 2000;
          opacity: 0;
          pointer-events: none;
          transition: all 0.4s var(--transition-snap);
          max-width: 90vw;
        }

        .toast-container.visible {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
          pointer-events: auto;
        }

        .toast-container.success {
          border-color: var(--indigo-light);
        }

        .toast-container.info {
          border-color: var(--sunflower);
        }

        .toast-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .toast-container.success .toast-icon {
          color: var(--indigo-light);
        }

        .toast-container.info .toast-icon {
          color: var(--sunflower);
        }

        .toast-icon svg {
          width: 100%;
          height: 100%;
        }

        .toast-message {
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }

        .toast-dismiss {
          width: 20px;
          height: 20px;
          background: none;
          border: none;
          color: var(--parchment);
          opacity: 0.5;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
          padding: 0;
        }

        .toast-dismiss:hover {
          opacity: 1;
          transform: rotate(90deg);
        }

        .toast-dismiss svg {
          width: 100%;
          height: 100%;
        }

        /* ═══════════════════════════════════════
           CONTAINER & BACKGROUND
        ═══════════════════════════════════════ */

        .admin-container {
          min-height: 100vh;
          background: var(--parchment);
          position: relative;
          overflow-x: hidden;
          font-family: var(--font-main);
          color: var(--ink);
        }

        .bg-canvas {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          z-index: 0;
        }

        .bg-wash {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .bg-wash.wash-indigo {
          background: radial-gradient(
            ellipse 70% 50% at 15% 80%,
            rgba(38, 70, 83, 0.03) 0%,
            transparent 70%
          );
        }

        .bg-wash.wash-cinnabar {
          background: radial-gradient(
            ellipse 60% 45% at 85% 20%,
            rgba(179, 58, 58, 0.03) 0%,
            transparent 70%
          );
        }

        .paper-texture {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.15;
          z-index: 1;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
        }

        .scan-lines {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          opacity: 0.5;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.015) 2px,
            rgba(0, 0, 0, 0.015) 4px
          );
        }

        .corner-decor {
          position: fixed;
          width: 60px; height: 60px;
          z-index: 3;
          color: var(--ink);
          opacity: 0.1;
        }

        .corner-decor.top-left { top: 1rem; left: 1rem; }
        .corner-decor.top-right { top: 1rem; right: 1rem; }
        .corner-decor.bottom-left { bottom: 1rem; left: 1rem; }
        .corner-decor.bottom-right { bottom: 1rem; right: 1rem; }

        /* ═══════════════════════════════════════
           MAIN WRAPPER
        ═══════════════════════════════════════ */

        .main-wrapper {
          position: relative;
          z-index: 10;
          min-height: 100vh;
          padding: 1rem 2rem 2rem;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.8s var(--transition-smooth);
        }

        .main-wrapper.loaded {
          opacity: 1;
          transform: translateY(0);
        }

        /* ═══════════════════════════════════════
           TOP BAR
        ═══════════════════════════════════════ */

        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          margin-bottom: 2rem;
          border-bottom: 1px dashed rgba(26, 26, 46, 0.12);
          background: rgba(245, 240, 225, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: var(--radius-sm);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .top-bar-left, .top-bar-right { flex: 1; }

        .top-bar-center {
          position: absolute;
          left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          justify-content: center;
        }

        .top-bar-right {
          display: flex;
          justify-content: flex-end;
        }

        .system-id {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .hanko-mini {
          width: 36px; height: 36px;
          background: var(--cinnabar);
          border: 2px solid var(--cinnabar-dark);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(-5deg);
          transition: transform 0.3s var(--transition-snap);
        }

        .hanko-mini:hover { transform: rotate(0deg) scale(1.05); }

        .hanko-mini span {
          font-size: 0.7rem;
          font-weight: 900;
          color: var(--parchment);
          letter-spacing: 0.05em;
        }

        .system-info { display: flex; flex-direction: column; }

        .system-label {
          font-size: 0.9rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: var(--ink);
        }

        .system-version {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          color: var(--ink-muted);
          letter-spacing: 0.05em;
        }

        .time-display {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .time-value {
          font-family: var(--font-mono);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.1em;
        }

        .date-value {
          font-size: 0.65rem;
          color: var(--ink-muted);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .status-beacon {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(42, 157, 143, 0.1);
          border: 1px solid var(--indigo-light);
          border-radius: var(--radius-sm);
        }

        .beacon-dot {
          width: 8px; height: 8px;
          background: var(--indigo-light);
          border-radius: 50%;
          animation: beacon-pulse 2s infinite;
        }

        @keyframes beacon-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(42, 157, 143, 0.4); }
          50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(42, 157, 143, 0); }
        }

        .beacon-label {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--indigo);
        }

        /* ═══════════════════════════════════════
           HERO SECTION
        ═══════════════════════════════════════ */

        .hero-section {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 3rem;
          align-items: center;
          margin-bottom: 3rem;
          padding: 2rem 0;
        }

        @media (max-width: 900px) {
          .hero-section { grid-template-columns: 1fr; }
          .hero-decoration { display: none; }
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 1rem;
          background: var(--ink);
          color: var(--sunflower);
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          margin-bottom: 1.5rem;
          border-radius: var(--radius-sm);
        }

        .badge-icon { font-size: 0.5rem; }

        .hero-title { margin-bottom: 1rem; }

        .title-line {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .title-line.main { justify-content: flex-start; }

        .title-text {
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          font-weight: 900;
          letter-spacing: 0.05em;
          line-height: 1;
          color: var(--ink);
        }

        .title-brush {
          width: 60px; height: 4px;
          background: var(--cinnabar);
          border-radius: 2px;
          animation: brush-extend 1s var(--transition-snap) forwards;
        }

        .title-brush.right { animation-delay: 0.3s; }

        @keyframes brush-extend {
          from { width: 0; opacity: 0; }
          to { width: 60px; opacity: 1; }
        }

        .hero-subtitle {
          font-size: 0.9rem;
          color: var(--ink-muted);
          letter-spacing: 0.05em;
          margin-bottom: 2rem;
          max-width: 400px;
        }

        .hero-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        @media (max-width: 768px) {
          .hero-stats { grid-template-columns: repeat(2, 1fr); }
        }

        .stat-card {
          background: var(--parchment-light);
          border: 2px solid var(--ink);
          border-radius: var(--radius-sm);
          padding: 1rem;
          position: relative;
          transition: all 0.3s var(--transition-smooth);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 3px 3px 0 var(--ink);
        }

        .stat-card:active {
          transform: translateY(0);
          box-shadow: none;
        }

        .stat-icon {
          width: 32px; height: 32px;
          margin-bottom: 0.75rem;
          color: var(--ink);
          opacity: 0.6;
        }

        .stat-icon.accent { color: var(--cinnabar); opacity: 1; }
        .stat-icon.gold { color: var(--gold); opacity: 1; }
        .stat-icon svg { width: 100%; height: 100%; }

        .stat-content { margin-bottom: 0.75rem; }

        .stat-value {
          display: block;
          font-family: var(--font-mono);
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--ink);
          line-height: 1;
        }

        .stat-label {
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--ink-muted);
          text-transform: uppercase;
        }

        .stat-bar {
          height: 3px;
          background: var(--parchment-dark);
          overflow: hidden;
          border-radius: 2px;
        }

        .stat-fill {
          height: 100%;
          background: var(--ink);
          border-radius: 2px;
          transition: width 1s var(--transition-smooth);
        }

        .stat-fill.accent { background: var(--cinnabar); }
        .stat-fill.gold { background: var(--gold); }

        /* Hero Decoration */
        .hero-decoration {
          position: relative;
          width: 200px; height: 200px;
        }

        .deco-circle {
          position: absolute;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .deco-circle.outer {
          inset: 0;
          border: 2px solid var(--ink);
          opacity: 0.06;
          animation: rotate-slow 30s linear infinite;
        }

        .deco-circle.middle {
          inset: 20px;
          border: 1px dashed var(--cinnabar);
          opacity: 0.15;
          animation: rotate-slow 20s linear infinite reverse;
        }

        .deco-circle.inner {
          inset: 40px;
          background: var(--parchment-light);
          border: 3px solid var(--ink);
        }

        .deco-core {
          width: 40px; height: 40px;
          color: var(--cinnabar);
        }

        .deco-core svg { width: 100%; height: 100%; }

        @keyframes rotate-slow { to { transform: rotate(360deg); } }

        .orbit-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px dashed var(--ink-muted);
          opacity: 0.1;
        }

        .orbit-ring.ring1 {
          inset: -20px;
          animation: rotate-slow 25s linear infinite;
        }

        .orbit-ring.ring2 {
          inset: -40px;
          animation: rotate-slow 35s linear infinite reverse;
        }

        .orbit-dot {
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 8px; height: 8px;
          background: var(--cinnabar);
          border-radius: 50%;
        }

        /* ═══════════════════════════════════════
           NAVIGATION GRID
        ═══════════════════════════════════════ */

        .nav-grid { margin-bottom: 3rem; }

        .section-header {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .header-line {
          flex: 1;
          height: 0;
          border: none;
          border-top: 2px dashed var(--ink-muted);
          opacity: 0.2;
        }

        .section-header h2 {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: var(--ink-muted);
          white-space: nowrap;
        }

        .header-number {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--cinnabar);
        }

        .cards-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.25rem;
        }

        /* Navigation Cards */
        .nav-card {
          position: relative;
          background: var(--parchment-light);
          border: 3px solid var(--ink);
          border-radius: var(--radius-sm);
          padding: 1.75rem;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.35s var(--transition-smooth);
          animation: card-enter 0.5s var(--transition-smooth) backwards;
        }

        @keyframes card-enter {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .nav-card::before {
          content: '';
          position: absolute;
          inset: 6px;
          border: 1px solid var(--ink);
          border-radius: calc(var(--radius-sm) - 1px);
          opacity: 0.06;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        .nav-card:hover {
          transform: translate(-4px, -4px);
          box-shadow: var(--shadow-hard);
        }

        .nav-card:active {
          transform: translate(-1px, -1px);
          box-shadow: 1px 1px 0 var(--ink);
        }

        .nav-card:hover::before { opacity: 0.12; }

        .nav-card.featured {
          grid-column: span 2;
          background: var(--ink);
          color: var(--parchment);
        }

        @media (max-width: 768px) {
          .nav-card.featured { grid-column: span 1; }
        }

        .nav-card.featured .card-number,
        .nav-card.featured .card-title,
        .nav-card.featured .card-subtitle,
        .nav-card.featured .card-desc { color: var(--parchment); }

        .nav-card.featured .card-subtitle { opacity: 0.7; }
        .nav-card.featured .card-desc { opacity: 0.6; }

        .nav-card.featured .card-footer {
          color: var(--sunflower);
          border-color: var(--sunflower);
        }

        .nav-card.featured:hover { box-shadow: 4px 4px 0 var(--sunflower); }
        .nav-card.featured:active { box-shadow: 1px 1px 0 var(--sunflower); }

        .nav-card.danger { border-color: var(--cinnabar); }
        .nav-card.danger .card-title { color: var(--cinnabar); }

        .nav-card.danger:hover {
          box-shadow: 4px 4px 0 var(--cinnabar);
          border-color: var(--cinnabar-dark);
        }

        .nav-card.danger:hover .card-icon {
          color: var(--cinnabar) !important;
          opacity: 1;
        }

        .nav-card.danger:active { box-shadow: 1px 1px 0 var(--cinnabar); }

        .card-pattern {
          position: absolute;
          inset: 0;
          opacity: 0.03;
          pointer-events: none;
        }

        .nav-card.featured .card-pattern { opacity: 0.04; }

        .card-corners .corner {
          position: absolute;
          width: 12px; height: 12px;
          border-color: var(--ink);
          border-style: solid;
          opacity: 0.15;
          transition: opacity 0.3s, transform 0.3s;
        }

        .card-corners .corner.tl { top: 8px; left: 8px; border-width: 2px 0 0 2px; }
        .card-corners .corner.tr { top: 8px; right: 8px; border-width: 2px 2px 0 0; }
        .card-corners .corner.bl { bottom: 8px; left: 8px; border-width: 0 0 2px 2px; }
        .card-corners .corner.br { bottom: 8px; right: 8px; border-width: 0 2px 2px 0; }

        .nav-card.featured .card-corners .corner { border-color: var(--parchment); }

        .nav-card:hover .card-corners .corner {
          opacity: 0.4;
          transform: scale(1.2);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.25rem;
        }

        .card-number {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--ink-muted);
          opacity: 0.5;
        }

        .card-icon {
          width: 36px; height: 36px;
          opacity: 0.6;
          transition: all 0.3s;
        }

        .card-icon svg { width: 100%; height: 100%; }

        .nav-card:hover .card-icon {
          opacity: 1;
          transform: scale(1.1);
        }

        .nav-card.featured .card-icon {
          color: var(--sunflower);
          opacity: 0.8;
        }

        .card-body { margin-bottom: 1.5rem; }

        .card-title {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          margin-bottom: 0.25rem;
        }

        .card-subtitle {
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          color: var(--cinnabar);
          text-transform: uppercase;
          margin-bottom: 0.75rem;
          display: block;
        }

        .nav-card.indigo .card-subtitle { color: var(--indigo); }
        .nav-card.gold .card-subtitle { color: var(--gold); }
        .nav-card.muted .card-subtitle { color: var(--ink-muted); }
        .nav-card.danger .card-subtitle { color: var(--cinnabar); }

        .card-desc {
          font-size: 0.85rem;
          color: var(--ink-muted);
          line-height: 1.5;
        }

        .card-footer {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding-bottom: 0.25rem;
          border-bottom: 2px solid var(--ink);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--ink);
          transition: all 0.3s;
        }

        .card-footer svg {
          width: 14px; height: 14px;
          transition: transform 0.3s var(--transition-snap);
        }

        .nav-card:hover .card-footer svg { transform: translateX(4px); }

        .card-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, transparent 0%, transparent 100%);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        .nav-card:hover .card-glow {
          opacity: 0.04;
          background: radial-gradient(circle at 50% 50%, var(--cinnabar), transparent 70%);
        }

        .nav-card.featured:hover .card-glow {
          background: radial-gradient(circle at 50% 50%, var(--sunflower), transparent 70%);
        }

        /* ═══════════════════════════════════════
           FOOTER
        ═══════════════════════════════════════ */

        .admin-footer {
          border-top: 1px dashed rgba(26, 26, 46, 0.1);
          padding-top: 1.5rem;
        }

        .footer-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
        }

        .footer-left, .footer-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .footer-label {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--ink-muted);
          opacity: 0.5;
        }

        .footer-value {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--ink);
          opacity: 0.6;
        }

        .footer-center {
          flex: 1;
          max-width: 300px;
        }

        .pulse-bar {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 2px;
          height: 20px;
        }

        .pulse-segment {
          width: 3px;
          background: var(--cinnabar);
          opacity: 0.25;
          border-radius: 1px;
          transition: height 0.1s ease-out;
        }

        /* ═══════════════════════════════════════
           MODAL — portaled to document.body
        ═══════════════════════════════════════ */

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(26, 26, 46, 0.85);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 1rem;
          animation: fade-in 0.3s ease;
          overflow-y: auto;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          width: 100%;
          max-width: 540px;
          max-height: 90vh;
          overflow-y: auto;
          background: var(--parchment);
          border: 3px solid var(--ink);
          border-radius: var(--radius-md);
          position: relative;
          margin: auto;
          animation: modal-slide 0.4s var(--transition-snap);
          font-family: var(--font-main);
          color: var(--ink);
        }

        @keyframes modal-slide {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .modal-corners .corner {
          position: absolute;
          width: 16px; height: 16px;
          border-color: var(--ink);
          border-style: solid;
          z-index: 1;
          opacity: 0.7;
        }

        .modal-corners .corner.tl { top: -2px; left: -2px; border-width: 3px 0 0 3px; }
        .modal-corners .corner.tr { top: -2px; right: -2px; border-width: 3px 3px 0 0; }
        .modal-corners .corner.bl { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; }
        .modal-corners .corner.br { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 1.5rem 1.25rem;
          border-bottom: 2px dashed rgba(26, 26, 46, 0.2);
        }

        .modal-title-group {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .modal-hanko {
          width: 45px; height: 45px;
          background: var(--cinnabar);
          border: 2px solid var(--cinnabar-dark);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(-5deg);
          transition: transform 0.3s var(--transition-snap);
        }

        .modal-hanko:hover { transform: rotate(0deg) scale(1.05); }

        .modal-hanko span {
          font-size: 0.6rem;
          font-weight: 900;
          color: var(--parchment);
          letter-spacing: 0.05em;
        }

        .modal-titles { display: flex; flex-direction: column; }

        .modal-subtitle-text {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--cinnabar);
          text-transform: uppercase;
        }

        .modal-title-text {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--ink);
          margin: 0;
        }

        .modal-close {
          width: 40px; height: 40px;
          background: var(--parchment-light);
          border: 2px solid var(--ink);
          border-radius: var(--radius-sm);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s var(--transition-smooth);
          flex-shrink: 0;
        }

        .modal-close .crisp-icon {
          transition: transform 0.3s var(--transition-snap),
                      filter 0.25s var(--transition-smooth),
                      opacity 0.25s var(--transition-smooth);
        }

        .close-x {
          font-size: 28px !important;
          font-weight: bold !important;
          color: #333 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          height: 100% !important;
          line-height: 1 !important;
          transition: all 0.3s ease !important;
          user-select: none !important;
        }

        .modal-close:hover {
          background: var(--cinnabar);
          border-color: var(--cinnabar-dark);
          box-shadow: 0 3px 10px rgba(179, 58, 58, 0.25);
        }

        .modal-close:hover .crisp-icon {
          transform: rotate(90deg);
          opacity: 1;
          filter: invert(100%) !important;
        }

        .modal-close:hover .close-x {
          transform: rotate(90deg) !important;
          color: white !important;
        }

        .modal-close:active {
          transform: scale(0.92);
          box-shadow: none;
        }

        .modal-error {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 1rem 1.5rem 0;
          padding: 0.875rem 1rem;
          background: rgba(179, 58, 58, 0.08);
          border: 2px solid var(--cinnabar);
          border-radius: var(--radius-sm);
          color: var(--cinnabar-dark);
          font-size: 0.8rem;
          font-weight: 600;
          animation: shake 0.4s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .modal-error svg {
          width: 18px; height: 18px;
          flex-shrink: 0;
        }

        .modal-form { padding: 1.5rem; }

        .form-section { margin-bottom: 1.5rem; }
        .form-section:last-child { margin-bottom: 0; }

        .section-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed rgba(26, 26, 46, 0.2);
        }

        .label-number {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--parchment);
          background: var(--ink);
          padding: 0.2rem 0.4rem;
          border-radius: 2px;
        }

        .section-label span:last-child {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--ink);
          text-transform: uppercase;
        }

        .input-group { margin-bottom: 1rem; }
        .input-group.full { width: 100%; }

        .input-group label {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--ink-muted);
          text-transform: uppercase;
          margin-bottom: 0.4rem;
        }

        .input-row { display: flex; gap: 1rem; }
        .input-row .input-group { flex: 1; }

        .neo-input,
        .neo-select,
        .neo-textarea {
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--parchment-light);
          border: 2px solid var(--ink);
          border-radius: var(--radius-sm);
          font-family: var(--font-main);
          font-size: 0.9rem;
          color: var(--ink);
          outline: none;
          transition: all 0.2s var(--transition-smooth);
        }

        .neo-input:focus,
        .neo-select:focus,
        .neo-textarea:focus {
          border-color: var(--indigo);
          box-shadow: 0 0 0 3px rgba(38, 70, 83, 0.1);
        }

        .neo-input::placeholder,
        .neo-textarea::placeholder {
          color: var(--ink-muted);
          opacity: 0.5;
        }

        .neo-input[type="number"]::-webkit-outer-spin-button,
        .neo-input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .neo-input[type="number"] {
          -moz-appearance: textfield;
        }

        .neo-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .select-wrapper { position: relative; }

        .select-wrapper svg {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px; height: 18px;
          color: var(--ink);
          pointer-events: none;
        }

        .neo-select {
          appearance: none;
          cursor: pointer;
          padding-right: 2.5rem;
        }

        /* Upload Zone */
        .upload-zone { position: relative; }
        .file-input { display: none; }

        .upload-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
          border: 2px dashed var(--ink);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .upload-label:hover {
          background: rgba(38, 70, 83, 0.03);
          border-color: var(--indigo);
          box-shadow: var(--shadow-hover);
        }

        .upload-icon {
          width: 48px; height: 48px;
          color: var(--ink-muted);
          transition: all 0.3s;
        }

        .upload-label:hover .upload-icon {
          color: var(--indigo);
          transform: translateY(-4px);
        }

        .upload-icon svg { width: 100%; height: 100%; }

        .upload-main {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--ink);
        }

        .upload-hint {
          font-size: 0.7rem;
          color: var(--ink-muted);
        }

        .upload-preview {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .preview-item { position: relative; }

        .preview-item img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border: 2px solid var(--ink);
          border-radius: var(--radius-sm);
          image-rendering: -webkit-optimize-contrast;
        }

        .preview-name {
          display: block;
          font-size: 0.6rem;
          color: var(--ink-muted);
          margin-top: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Modal Actions */
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          border-top: 2px dashed rgba(26, 26, 46, 0.15);
          background: var(--parchment-dark);
          border-bottom-left-radius: var(--radius-md);
          border-bottom-right-radius: var(--radius-md);
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          font-family: var(--font-main);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          border: 2px solid var(--ink);
          border-radius: var(--radius-sm);
          transition: all 0.25s var(--transition-snap);
          position: relative;
          overflow: hidden;
        }

        .action-btn::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
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

        .action-btn.primary .crisp-icon {
          transition: transform 0.25s var(--transition-smooth),
                      opacity 0.25s var(--transition-smooth),
                      filter 0.25s var(--transition-smooth);
        }

        .action-btn.primary:hover .crisp-icon {
          transform: scale(1.15);
        }

        .action-btn.secondary {
          background: transparent;
          color: var(--ink);
        }

        .action-btn.secondary::after { background: var(--cinnabar); }

        .action-btn.secondary:hover {
          background: var(--ink);
          color: var(--parchment);
          box-shadow: var(--shadow-btn);
        }

        .action-btn.secondary:active {
          transform: translateY(0);
          box-shadow: none;
        }

        .action-btn.primary {
          background: var(--ink);
          color: var(--parchment);
        }

        .action-btn.primary::after { background: var(--sunflower); }

        .action-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 3px 3px 0 var(--sunflower);
        }

        .action-btn.primary:active {
          transform: translateY(0);
          box-shadow: none;
        }

        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        .spinner {
          width: 14px; height: 14px;
          border: 2px solid var(--parchment);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* ═══════════════════════════════════════
           RESPONSIVE
        ═══════════════════════════════════════ */

        @media (max-width: 768px) {
          .main-wrapper { padding: 1rem; }

          .top-bar {
            flex-wrap: wrap;
            gap: 1rem;
            position: relative;
            padding: 1rem;
          }

          .top-bar-left,
          .top-bar-center,
          .top-bar-right {
            flex: none;
            width: 100%;
            justify-content: center;
          }

          .top-bar-center {
            position: relative;
            left: auto; top: auto;
            transform: none;
          }

          .title-text { font-size: 2rem; }
          .hero-stats { grid-template-columns: 1fr 1fr; }
          .cards-container { grid-template-columns: 1fr; }

          .footer-content {
            flex-direction: column;
            gap: 1rem;
          }

          .footer-center { order: -1; }

          .modal-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .modal-close {
            position: absolute;
            top: 1rem; right: 1rem;
          }

          .input-row { flex-direction: column; }
          .modal-actions { flex-direction: column; }

          .action-btn {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 600px) {
          .section-header {
            flex-direction: column;
            gap: 0.75rem;
          }

          .header-line {
            width: 60%;
            flex: none;
          }

          .toast-message { font-size: 0.7rem; }

          .toast-container {
            max-width: 95vw;
            padding: 0.75rem 1rem;
          }

          .crisp-icon {
            width: 18px !important;
            height: 18px !important;
          }

          .crisp-icon.entry-icon-sm {
            width: 12px !important;
            height: 12px !important;
          }
        }

        /* ═══════════════════════════════════════
           REDUCED MOTION
        ═══════════════════════════════════════ */

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* ═══════════════════════════════════════
           SCROLLBAR & SELECTION
        ═══════════════════════════════════════ */

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: var(--parchment-dark); }
        ::-webkit-scrollbar-thumb { background: var(--ink-muted); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--ink); }

        ::selection {
          background: var(--sunflower);
          color: var(--ink);
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
          text-align: center;
          animation: overlayFadeIn 0.4s ease-out;
        }
        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .loader-content-v2 {
          display: flex; flex-direction: column; align-items: center;
          gap: 2.5rem; max-width: 400px;
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
          font-family: var(--font-main); font-size: 1.25rem; 
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

        .scan-line-v2 {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, transparent, rgba(179, 58, 58, 0.1), transparent);
          height: 100px; width: 100%;
          animation: scanV2 3s linear infinite;
          pointer-events: none;
        }
        @keyframes scanV2 { from { top: -100px; } to { top: 100%; } }
      `}</style>
    </div>
  );
}