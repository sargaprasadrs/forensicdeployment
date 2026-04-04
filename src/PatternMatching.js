// src/PatternMatching.js
import React, { useState, useEffect } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { auth, db } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getDocs, query, where } from "firebase/firestore";
export default function PatternMatching() {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [matches, setMatches] = useState([]);
  const [generatedImage, setGeneratedImage] = useState(null);
  const location = useLocation();
  const recognitionResult = location.state?.matchResult;


  const sessionId = useRef(
    crypto.randomUUID?.() || Date.now().toString() + Math.random().toString(36)
  );
  const logUserActivity = useCallback(async (type, action, meta = {}) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await addDoc(collection(db, "user_activity"), {
        uid: user.uid,
        email: user.email,
        sessionId: sessionId.current,
        screen: "PATTERN_MATCHING",
        type,
        action,
        meta,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("PatternMatching activity log failed:", err);
    }
  }, []);
  useEffect(() => {
    setIsLoaded(true);
    logUserActivity("PAGE", "PATTERN_MATCH_VIEW");

    const img = localStorage.getItem("generatedSketch");
    if (img) setGeneratedImage(`data:image/png;base64,${img}`);
  }, [logUserActivity]);

  useEffect(() => {
    const fetchMatchedPeople = async () => {
      if (!recognitionResult?.matches || recognitionResult.matches.length === 0) {
        // Fallback for old API response or single match
        if (recognitionResult?.label) {
          fetchSingleMatch(recognitionResult);
        }
        return;
      }

      try {
        const allMatches = [];
        for (const match of recognitionResult.matches) {
          const q = query(
            collection(db, "admin", "default_admin", "datasets"),
            where("culprit.name", "==", match.label)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const docData = snapshot.docs[0].data();
            allMatches.push({
              id: snapshot.docs[0].id,
              name: docData.culprit.name,
              confidenceValue: Math.round(match.similarity * 100),
              confidence: `${Math.round(match.similarity * 100)}%`,
              img: match.image_url,
              age: docData.culprit.age,
              gender: docData.culprit.gender,
              location: docData.culprit.location || "Unknown",
              caseId: docData.datasetId || "N/A"
            });
          }
        }
        setMatches(allMatches);
      } catch (error) {
        console.error("Error fetching matches:", error);
      }
    };

    const fetchSingleMatch = async (res) => {
      try {
        const q = query(
          collection(db, "admin", "default_admin", "datasets"),
          where("culprit.name", "==", res.label)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          setMatches([{
            id: snapshot.docs[0].id,
            name: docData.culprit.name,
            confidenceValue: Math.round(res.similarity * 100),
            confidence: `${Math.round(res.similarity * 100)}%`,
            img: res.image_url,
            age: docData.culprit.age,
            gender: docData.culprit.gender,
            location: docData.culprit.location || "Unknown",
            caseId: docData.datasetId || "N/A"
          }]);
        }
      } catch (error) {
        console.error("Error fetching single match:", error);
      }
    };

    fetchMatchedPeople();
  }, [recognitionResult, logUserActivity]);

  useEffect(() => {
    if (selectedMatch) {
      logUserActivity("MODAL", "MATCH_DETAILS_OPENED", {
        matchId: selectedMatch.id,
        name: selectedMatch.name,
      });
    }
  }, [selectedMatch, logUserActivity]);






  const exportToPDF = () => {
    logUserActivity("EXPORT", "MATCH_DETAILS_PDF", {
      matchId: selectedMatch.id,
      name: selectedMatch.name,
      confidence: selectedMatch.confidenceValue,
    });
    const input = document.getElementById("details-section");
    html2canvas(input, { backgroundColor: "#F5F0E1" }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF();
      pdf.addImage(imgData, "PNG", 10, 10, 180, 160);
      pdf.save(`${selectedMatch.name}_details.pdf`);
    });
  };

  const getConfidenceColor = (value) => {
    if (value >= 90) return "var(--cinnabar)";
    if (value >= 80) return "var(--sunflower)";
    return "var(--indigo)";
  };

  return (
    <div className="neo-edo-container">
      {/* Paper Texture Overlay */}
      <div className="paper-texture" />

      {/* Decorative Ink Splatters */}
      <svg className="ink-splatter top-left" viewBox="0 0 100 100">
        <circle cx="15" cy="25" r="12" fill="var(--cinnabar)" opacity="0.1" />
        <circle cx="30" cy="15" r="6" fill="var(--cinnabar)" opacity="0.08" />
        <circle cx="10" cy="45" r="4" fill="var(--cinnabar)" opacity="0.06" />
      </svg>

      <svg className="ink-splatter top-right" viewBox="0 0 100 100">
        <circle cx="85" cy="20" r="10" fill="var(--indigo)" opacity="0.08" />
        <circle cx="70" cy="35" r="5" fill="var(--indigo)" opacity="0.06" />
      </svg>

      {/* Main Content */}
      <main className={`main-content ${isLoaded ? 'loaded' : ''}`}>

        {/* Header Section */}
        <header className="header-section">
          <div className="brush-stroke-container">
            <h1 className="main-title">
              <span className="title-accent">FORENSIC</span>
              <span className="title-main">PATTERN MATCH</span>
            </h1>
            <div className="title-underline" />
          </div>
          <p className="subtitle">AI-Powered Suspect Identification System</p>
        </header>

        {/* Sketch Display Panel */}
        <section className="manga-panel sketch-panel">
          <div className="panel-header">
            <span className="panel-number">01</span>
            <h2>Generated Sketch</h2>
            <div className="hanko-stamp">
              <span>ACTIVE</span>
            </div>
          </div>

          <div className="sketch-display">
            <div className="sketch-frame">
              <div className="brush-mask">
                <img
                  src={generatedImage || ""}
                  alt="Generated Suspect"
                  className={`sketch-image ${!generatedImage ? 'placeholder' : ''}`}
                />
              </div>
              <div className="sketch-corner tl" />
              <div className="sketch-corner tr" />
              <div className="sketch-corner bl" />
              <div className="sketch-corner br" />
            </div>

            <div className="sketch-info">
              <div className="info-item">
                <span className="info-label">STATUS</span>
                <span className="info-value status-active">SEARCHING</span>
              </div>
              <div className="info-item">
                <span className="info-label">MATCHES FOUND</span>
                <span className="info-value">{matches.length}</span>
              </div>
              <div className="info-item">
                <span className="info-label">DATABASE</span>
                <span className="info-value">NATIONAL</span>
              </div>
            </div>
          </div>
        </section>

        {/* Results Section */}
        <section className="results-section">
          <div className="section-header">
            <div className="header-line" />
            <h2 className="section-title">
              <span className="title-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
              </span>
              Search Results
            </h2>
            <div className="header-line" />
          </div>

          {/* Manga Grid for Results */}
          <div className="results-manga-grid">
            {matches.map((match, index) => (
              <article
                key={match.id}
                className={`match-card manga-panel ${hoveredCard === match.id ? 'hovered' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onMouseEnter={() => {
                  setHoveredCard(match.id);
                  logUserActivity("HOVER", "MATCH_CARD_HOVER", {
                    matchId: match.id,
                    name: match.name,
                    confidence: match.confidenceValue,
                  });
                }}

                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="card-panel-number">{String(index + 1).padStart(2, '0')}</div>

                <div className="card-image-container">
                  <div className="splatter-mask">
                    <img src={match.img} alt={match.name} className="card-image" />
                  </div>
                  <div className="confidence-badge" style={{ '--conf-color': getConfidenceColor(match.confidenceValue) }}>
                    <span className="conf-value">{match.confidence}</span>
                    <span className="conf-label">MATCH</span>
                  </div>
                </div>

                <div className="card-content">
                  <h3 className="card-name">{match.name}</h3>
                  <p className="card-case">{match.caseId}</p>

                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{
                        width: `${match.confidenceValue}%`,
                        background: getConfidenceColor(match.confidenceValue)
                      }}
                    />
                  </div>

                  <button
                    className="view-button"
                    onClick={() => {
                      setSelectedMatch(match);
                      logUserActivity("ACTION", "VIEW_MATCH_DETAILS", {
                        matchId: match.id,
                        name: match.name,
                        confidence: match.confidenceValue,
                        caseId: match.caseId,
                      });
                    }}

                  >
                    <span>VIEW DETAILS</span>
                    <svg className="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Footer Decoration */}
        <footer className="footer-decoration">
          <div className="horizontal-rule">
            <div className="rule-line" />
            <div className="rule-emblem">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <div className="rule-line" />
          </div>
          <p className="footer-text">Pattern Recognition Module v2.1</p>
        </footer>
      </main>

      {/* Modal Popup */}
      {selectedMatch && (
        <div className="modal-overlay" onClick={() => {
          logUserActivity("MODAL", "MATCH_DETAILS_CLOSED", {
            matchId: selectedMatch.id,
          });
          setSelectedMatch(null);
        }}>
          <div className="modal-content manga-panel" id="details-section" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedMatch(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="modal-header">
              <span className="modal-panel-number">PROFILE</span>
              <div className="hanko-stamp large">
                <span>MATCH</span>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-image-section">
                <div className="modal-image-frame">
                  <img src={selectedMatch.img} alt={selectedMatch.name} className="modal-image" />
                </div>
                <div className="modal-confidence" style={{ '--conf-color': getConfidenceColor(selectedMatch.confidenceValue) }}>
                  <span className="conf-number">{selectedMatch.confidence}</span>
                  <span className="conf-text">CONFIDENCE</span>
                </div>
              </div>

              <div className="modal-details">
                <h2 className="modal-name">{selectedMatch.name}</h2>
                <p className="modal-case">{selectedMatch.caseId}</p>

                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">AGE</span>
                    <span className="detail-value">{selectedMatch.age}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">GENDER</span>
                    <span className="detail-value">{selectedMatch.gender}</span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">LAST KNOWN LOCATION</span>
                    <span className="detail-value">{selectedMatch.location}</span>
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="action-button primary" onClick={exportToPDF}>
                    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>EXPORT PDF</span>
                  </button>
                  <button className="action-button secondary" onClick={() => setSelectedMatch(null)}>
                    <span>CLOSE</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ═══════════════════════════════════════
           NEO-EDO PATTERN MATCHING STYLES
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
          
          --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          
          --border-thick: 3px;
          --border-thin: 1.5px;
          
          --transition-snap: cubic-bezier(0.68, -0.55, 0.265, 1.55);
          --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
          
          --shadow-soft: 0 4px 20px rgba(26, 26, 46, 0.1);
          --shadow-hard: 4px 4px 0 var(--ink);
        }

        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * {
          box-sizing: border-box;
        }

        /* ═══════════════════════════════════════
           CONTAINER & BACKGROUND
        ═══════════════════════════════════════ */
        
        .neo-edo-container {
          min-height: 100vh;
          background: var(--parchment);
          position: relative;
          overflow-x: hidden;
          padding: 2rem;
        }

        .paper-texture {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.35;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
        }

        .ink-splatter {
          position: absolute;
          width: 150px;
          height: 150px;
          z-index: 0;
          pointer-events: none;
        }

        .ink-splatter.top-left {
          top: 20px;
          left: 20px;
        }

        .ink-splatter.top-right {
          top: 20px;
          right: 20px;
        }

        /* ═══════════════════════════════════════
           MAIN CONTENT ANIMATION
        ═══════════════════════════════════════ */
        
        .main-content {
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.8s var(--transition-smooth);
        }

        .main-content.loaded {
          opacity: 1;
          transform: translateY(0);
        }

        /* ═══════════════════════════════════════
           HEADER SECTION
        ═══════════════════════════════════════ */
        
        .header-section {
          text-align: center;
          margin-bottom: 2.5rem;
          padding: 1.5rem 0;
        }

        .brush-stroke-container {
          position: relative;
          display: inline-block;
        }

        .main-title {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          margin: 0;
        }

        .title-accent {
          font-family: var(--font-display);
          font-size: clamp(0.9rem, 1.8vw, 1.1rem);
          font-weight: 600;
          color: var(--cinnabar);
          letter-spacing: 0.5em;
          text-transform: uppercase;
        }

        .title-main {
          font-family: var(--font-display);
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 900;
          color: var(--ink);
          letter-spacing: 0.08em;
          line-height: 1;
        }

        .title-underline {
          height: 4px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            var(--cinnabar) 20%, 
            var(--cinnabar) 80%, 
            transparent 100%
          );
          margin-top: 1.25rem;
          animation: brushStroke 1s var(--transition-snap) forwards;
          transform-origin: left;
          border-radius: 2px;
        }

        @keyframes brushStroke {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        .subtitle {
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--ink-muted);
          margin-top: 1rem;
          letter-spacing: 0.05em;
          font-weight: 500;
        }

        /* ═══════════════════════════════════════
           MANGA PANELS
        ═══════════════════════════════════════ */
        
        .manga-panel {
          background: var(--parchment-light);
          border: var(--border-thick) solid var(--ink);
          position: relative;
          transition: all 0.3s var(--transition-smooth);
        }

        .manga-panel::before {
          content: '';
          position: absolute;
          inset: 5px;
          border: var(--border-thin) solid var(--ink);
          pointer-events: none;
          opacity: 0.15;
        }

        /* ═══════════════════════════════════════
           SKETCH PANEL
        ═══════════════════════════════════════ */
        
        .sketch-panel {
          padding: 1.5rem;
          margin-bottom: 2.5rem;
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid var(--ink);
        }

        .panel-number {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--parchment);
          background: var(--ink);
          padding: 0.25rem 0.5rem;
          letter-spacing: 0.05em;
        }

        .panel-header h2 {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0;
          flex: 1;
        }

        /* Hanko Stamp */
        .hanko-stamp {
          width: 50px;
          height: 50px;
          border: 3px solid var(--cinnabar);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transform: rotate(-15deg);
        }

        .hanko-stamp::before {
          content: '';
          position: absolute;
          inset: 3px;
          border: 1.5px solid var(--cinnabar);
          border-radius: 50%;
          opacity: 0.5;
        }

        .hanko-stamp span {
          font-family: var(--font-display);
          font-size: 0.5rem;
          font-weight: 900;
          color: var(--cinnabar);
          letter-spacing: 0.05em;
        }

        .hanko-stamp.large {
          width: 70px;
          height: 70px;
        }

        .hanko-stamp.large span {
          font-size: 0.65rem;
        }

        .sketch-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3rem;
          flex-wrap: wrap;
        }

        .sketch-frame {
          position: relative;
          width: 220px;
          height: 220px;
        }

        .brush-mask {
          width: 100%;
          height: 100%;
          overflow: hidden;
          border-radius: 8px;
          position: relative;
          border: 3px solid var(--ink);
        }

        .brush-mask::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, 
            transparent 40%,
            rgba(233, 196, 106, 0.1) 50%,
            transparent 60%
          );
          pointer-events: none;
          z-index: 1;
        }

        .sketch-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: contrast(1.1) saturate(0.9);
        }

        .sketch-corner {
          position: absolute;
          width: 20px;
          height: 20px;
          border-color: var(--cinnabar);
          border-style: solid;
          border-width: 0;
        }

        .sketch-corner.tl { top: -8px; left: -8px; border-top-width: 3px; border-left-width: 3px; }
        .sketch-corner.tr { top: -8px; right: -8px; border-top-width: 3px; border-right-width: 3px; }
        .sketch-corner.bl { bottom: -8px; left: -8px; border-bottom-width: 3px; border-left-width: 3px; }
        .sketch-corner.br { bottom: -8px; right: -8px; border-bottom-width: 3px; border-right-width: 3px; }

        .sketch-info {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0.75rem 1.25rem;
          background: var(--parchment);
          border: 2px solid var(--ink);
        }

        .info-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--ink-muted);
          letter-spacing: 0.1em;
        }

        .info-value {
          font-size: 1rem;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: 0.05em;
        }

        .status-active {
          color: var(--indigo-light);
          animation: statusPulse 1.5s infinite;
        }

        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* ═══════════════════════════════════════
           RESULTS SECTION
        ═══════════════════════════════════════ */
        
        .results-section {
          margin-bottom: 2rem;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .header-line {
          flex: 1;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--ink-muted), transparent);
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin: 0;
          white-space: nowrap;
        }

        .title-icon {
          width: 24px;
          height: 24px;
          color: var(--cinnabar);
        }

        .title-icon svg {
          width: 100%;
          height: 100%;
        }

        /* ═══════════════════════════════════════
           RESULTS GRID - ASYMMETRICAL MANGA LAYOUT
        ═══════════════════════════════════════ */
        
        .results-manga-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.5rem;
        }

        .match-card {
          padding: 0;
          overflow: hidden;
          animation: slideIn 0.5s var(--transition-snap) both;
        }

        .match-card:hover {
          transform: translate(-4px, -4px);
          box-shadow: var(--shadow-hard);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .card-panel-number {
          position: absolute;
          top: 0;
          left: 0;
          font-family: var(--font-display);
          font-size: 0.7rem;
          font-weight: 900;
          color: var(--parchment);
          background: var(--ink);
          padding: 0.35rem 0.6rem;
          z-index: 2;
        }

        .card-image-container {
          position: relative;
          height: 200px;
          overflow: hidden;
        }

        .splatter-mask {
          width: 100%;
          height: 100%;
          position: relative;
        }

        .splatter-mask::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60%;
          background: linear-gradient(to top, var(--parchment-light), transparent);
          pointer-events: none;
        }

        .card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s var(--transition-smooth);
        }

        .match-card:hover .card-image {
          transform: scale(1.05);
        }

        .confidence-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: var(--parchment);
          border: 2px solid var(--conf-color, var(--cinnabar));
          z-index: 2;
        }

        .conf-value {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 900;
          color: var(--conf-color, var(--cinnabar));
          line-height: 1;
        }

        .conf-label {
          font-size: 0.55rem;
          font-weight: 700;
          color: var(--ink-muted);
          letter-spacing: 0.1em;
        }

        .card-content {
          padding: 1.25rem;
        }

        .card-name {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--ink);
          margin: 0 0 0.25rem 0;
          letter-spacing: 0.03em;
        }

        .card-case {
          font-size: 0.7rem;
          color: var(--ink-muted);
          margin: 0 0 1rem 0;
          letter-spacing: 0.1em;
          font-weight: 600;
        }

        .confidence-bar {
          height: 6px;
          background: var(--parchment-dark);
          border: 1px solid var(--ink);
          margin-bottom: 1.25rem;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          transition: width 1s var(--transition-smooth);
        }

        .view-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: var(--parchment);
          border: 2px solid var(--ink);
          font-family: var(--font-body);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--ink);
          cursor: pointer;
          transition: all 0.25s var(--transition-snap);
        }

        .view-button:hover {
          background: var(--ink);
          color: var(--parchment);
        }

        .view-button:hover .btn-arrow {
          transform: translateX(4px);
          color: var(--sunflower);
        }

        .btn-arrow {
          width: 16px;
          height: 16px;
          transition: all 0.25s var(--transition-snap);
        }

        /* ═══════════════════════════════════════
           MODAL
        ═══════════════════════════════════════ */
        
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26, 26, 46, 0.85);
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

        .modal-content {
          width: 100%;
          max-width: 550px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 0;
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

        .close-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 36px;
          height: 36px;
          border: 2px solid var(--ink);
          background: var(--parchment);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: var(--cinnabar);
          border-color: var(--cinnabar);
        }

        .close-btn:hover svg {
          color: var(--parchment);
        }

        .close-btn svg {
          width: 18px;
          height: 18px;
          color: var(--ink);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 2px solid var(--ink);
        }

        .modal-panel-number {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--parchment);
          background: var(--ink);
          padding: 0.3rem 0.6rem;
          letter-spacing: 0.1em;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-image-section {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .modal-image-frame {
          width: 140px;
          height: 140px;
          border: 3px solid var(--ink);
          overflow: hidden;
        }

        .modal-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .modal-confidence {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem 1.5rem;
          border: 3px solid var(--conf-color, var(--cinnabar));
          background: var(--parchment);
        }

        .conf-number {
          font-family: var(--font-display);
          font-size: 2.5rem;
          font-weight: 900;
          color: var(--conf-color, var(--cinnabar));
          line-height: 1;
        }

        .conf-text {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--ink-muted);
          letter-spacing: 0.15em;
          margin-top: 0.25rem;
        }

        .modal-details {
          text-align: center;
        }

        .modal-name {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 900;
          color: var(--ink);
          margin: 0 0 0.25rem 0;
          letter-spacing: 0.05em;
        }

        .modal-case {
          font-size: 0.75rem;
          color: var(--ink-muted);
          letter-spacing: 0.15em;
          font-weight: 600;
          margin: 0 0 1.5rem 0;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .detail-item {
          padding: 0.75rem;
          background: var(--parchment);
          border: 2px solid var(--ink);
          text-align: left;
        }

        .detail-item.full-width {
          grid-column: 1 / -1;
        }

        .detail-label {
          display: block;
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--ink-muted);
          letter-spacing: 0.1em;
          margin-bottom: 0.25rem;
        }

        .detail-value {
          display: block;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--ink);
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        /* ═══════════════════════════════════════
           ACTION BUTTONS
        ═══════════════════════════════════════ */
        
        .action-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.85rem 1.25rem;
          background: var(--parchment);
          border: var(--border-thick) solid var(--ink);
          font-family: var(--font-body);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--ink);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.25s var(--transition-snap);
        }

        .action-button::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: var(--cinnabar);
          transform: scaleX(0);
          transform-origin: right;
          transition: transform 0.3s var(--transition-smooth);
        }

        .action-button:hover::after {
          transform: scaleX(1);
          transform-origin: left;
        }

        .action-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 0 var(--ink);
        }

        .action-button:active {
          transform: translateY(0);
          box-shadow: none;
        }

        .action-button.primary {
          background: var(--ink);
          color: var(--parchment);
        }

        .action-button.primary::after {
          background: var(--sunflower);
        }

        .action-button.primary:hover {
          background: var(--ink-light);
        }

        .action-button.primary .btn-icon {
          color: var(--sunflower);
        }

        .btn-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        /* ═══════════════════════════════════════
           FOOTER DECORATION
        ═══════════════════════════════════════ */
        
        .footer-decoration {
          margin-top: 3rem;
          padding-top: 2rem;
          text-align: center;
        }

        .horizontal-rule {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          margin-bottom: 1rem;
        }

        .rule-line {
          flex: 1;
          max-width: 120px;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--ink-muted) 50%,
            transparent
          );
        }

        .rule-emblem {
          width: 32px;
          height: 32px;
          color: var(--cinnabar);
          opacity: 0.5;
        }

        .rule-emblem svg {
          width: 100%;
          height: 100%;
        }

        .footer-text {
          font-family: var(--font-body);
          font-size: 0.7rem;
          color: var(--ink-muted);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          opacity: 0.6;
          margin: 0;
        }

        /* ═══════════════════════════════════════
           RESPONSIVE ADJUSTMENTS
        ═══════════════════════════════════════ */
        
        @media (max-width: 768px) {
          .neo-edo-container {
            padding: 1rem;
          }

          .sketch-display {
            flex-direction: column;
            gap: 2rem;
          }

          .sketch-frame {
            width: 180px;
            height: 180px;
          }

          .sketch-info {
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
          }

          .results-manga-grid {
            grid-template-columns: 1fr;
          }

          .modal-content {
            max-width: 100%;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .detail-item.full-width {
            grid-column: 1;
          }
        }

        @media (max-width: 480px) {
          .section-header {
            flex-direction: column;
            gap: 0.75rem;
          }

          .header-line {
            width: 60%;
            flex: none;
          }

          .modal-actions {
            flex-direction: column;
          }

          .action-button {
            width: 100%;
            justify-content: center;
          }
        }

        /* ═══════════════════════════════════════
           SELECTION & SCROLLBAR
        ═══════════════════════════════════════ */
        
        ::selection {
          background: var(--sunflower);
          color: var(--ink);
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: var(--parchment-dark);
        }

        ::-webkit-scrollbar-thumb {
          background: var(--ink-muted);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: var(--ink);
        }

        /* ═══════════════════════════════════════
           GLITCH EFFECT FOR PROCESSING STATES
        ═══════════════════════════════════════ */
        
        @keyframes glitchSlide {
          0% { transform: translateX(0); }
          10% { transform: translateX(-2px); }
          20% { transform: translateX(2px); }
          30% { transform: translateX(-1px); }
          40% { transform: translateX(1px); }
          50% { transform: translateX(0); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}