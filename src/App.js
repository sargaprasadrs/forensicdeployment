// src/App.js
// ═══════════════════════════════════════════════════════════════════════════════
//  ██╗    ██╗██╗████████╗███╗   ██╗███████╗███████╗███████╗
//  ██║    ██║██║╚══██╔══╝████╗  ██║██╔════╝██╔════╝██╔════╝
//  ██║ █╗ ██║██║   ██║   ██╔██╗ ██║█████╗  ███████╗███████╗
//  ██║███╗██║██║   ██║   ██║╚██╗██║██╔══╝  ╚════██║╚════██║
//  ╚███╔███╔╝██║   ██║   ██║ ╚████║███████╗███████║███████║
//   ╚══╝╚══╝ ╚═╝   ╚═╝   ╚═╝  ╚═══╝╚══════╝╚══════╝╚══════╝
//                      SKETCH SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Firebase-free portfolio demo: a single page (HomePage) that takes a witness
// description, extracts facial attributes via a Cloudflare Worker LLM, and
// generates an AI sketch. No auth, no database, no routing.

import React, { useEffect, useState } from "react";

// Pages
import HomePage from "./HomePage";

// CSS
import "./App.css";

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="neo-edo-app">
      <div className="global-paper-texture" />
      <HomePage />
      <GlobalDecorations />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="loading-content">
      <div className="loading-stamp">
        <div className="stamp-outer">
          <div className="stamp-inner">
            <span className="stamp-text">WS</span>
          </div>
        </div>
        <div className="stamp-shadow" />
      </div>

      <div className="loading-text">
        <span className="loading-label">INITIALIZING</span>
        <div className="loading-dots">
          <span className="dot" style={{ animationDelay: "0s" }}>.</span>
          <span className="dot" style={{ animationDelay: "0.2s" }}>.</span>
          <span className="dot" style={{ animationDelay: "0.4s" }}>.</span>
        </div>
      </div>

      <div className="loading-bar">
        <div className="loading-progress" />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL DECORATIONS
// ─────────────────────────────────────────────────────────────────────────────

const GlobalDecorations = () => (
  <>
    <svg
      className="corner-decoration top-left"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <path
        d="M0 0 L30 0 L30 3 L3 3 L3 30 L0 30 Z"
        fill="var(--ink)"
        opacity="0.1"
      />
    </svg>

    <svg
      className="corner-decoration bottom-right"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <path
        d="M100 100 L70 100 L70 97 L97 97 L97 70 L100 70 Z"
        fill="var(--ink)"
        opacity="0.1"
      />
    </svg>
  </>
);

export default App;
