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

import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";

// Protected route components
import UserRoute from "./UserRoute";
import AdminRoute from "./AdminRoute";

// Pages
import LoginScreen from "./LoginScreen";
import HomePage from "./HomePage";
import AttributeScreen from "./AttributeScreen";
import SuspectSketch from "./SuspectSketch";
import PatternMatching from "./PatternMatching";
import AdminHomeScreen from "./AdminHomeScreen";
import AdminSignup from "./AdminSignup";
import AdminUserAnalytics from "./AdminUserAnalytics";
import ProfileScreen from "./ProfileScreen";  // added

// CSS
import "./App.css";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE TRANSITION WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

const PageTransition = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState("fade-in");

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage("fade-out");
    }
  }, [location, displayLocation]);

  const handleAnimationEnd = () => {
    if (transitionStage === "fade-out") {
      setTransitionStage("fade-in");
      setDisplayLocation(location);
    }
  };

  return (
    <div
      className={`page-transition ${transitionStage}`}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED ROUTES WITH ROLE PROTECTION
// ─────────────────────────────────────────────────────────────────────────────

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <PageTransition>
      <Routes location={location}>
        {/* Public Landing - Now HomePage */}
        <Route path="/" element={<HomePage />} />
        
        {/* Authentication */}
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/admin-signup" element={<AdminSignup />} />

        {/* Protected routes */}
        <Route
          path="/attributes"
          element={
            <UserRoute>
              <AttributeScreen />
            </UserRoute>
          }
        />
        <Route
          path="/suspect-sketch"
          element={
            <UserRoute>
              <SuspectSketch />
            </UserRoute>
          }
        />
        <Route
          path="/pattern-matching"
          element={
            <UserRoute>
              <PatternMatching />
            </UserRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <UserRoute>
              <ProfileScreen />
            </UserRoute>
          }
        />

        {/* Admin only */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminHomeScreen />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUserAnalytics />
            </AdminRoute>
          }
        />

        {/* Fallback to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageTransition>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

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

      <Router>
        <AnimatedRoutes />
      </Router>

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