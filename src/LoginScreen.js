// src/LoginScreen.js
// ═══════════════════════════════════════════════════════════════════════════════
//  WITNESS SKETCH SYSTEM - AUTHENTICATION GATEWAY
//  "The path begins with a single step through the gate."
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "./firebaseConfig";
import {
  doc,
  setDoc,
  getDoc,
  addDoc,   
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { updateDoc } from "firebase/firestore";

export default function LoginScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Clear messages when switching modes
  useEffect(() => {
    setErrorMessage("");
    setSuccessMessage("");
  }, [isRegister, isAdmin]);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN HANDLER - Role-based navigation via Firestore
  // ═══════════════════════════════════════════════════════════════════════════
  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage("Please enter email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      if (isAdmin) {
        // ═══════════════════════════════════════
        // ADMIN MODE LOGIN
        // ═══════════════════════════════════════
        const adminSnap = await getDoc(doc(db, "admins", uid));

        if (adminSnap.exists() && adminSnap.data().active === true) {
  setSuccessMessage("Admin access granted...");

  // ✅ Update last login
  await updateDoc(doc(db, "admins", uid), {
    lastLoginAt: serverTimestamp(),
  });

  // ✅ Log activity
  await addDoc(collection(db, "user_activity"), {
    uid,
    type: "AUTH",
    action: "ADMIN_LOGIN",
    timestamp: serverTimestamp(),
  });

  navigate("/admin");
  return;
}


      } else {
        // ═══════════════════════════════════════
        // USER MODE LOGIN
        // Allows admins to login as users if they have a user account
        // ═══════════════════════════════════════
        const userSnap = await getDoc(doc(db, "users", uid));

        if (userSnap.exists() && userSnap.data().active === true) {
  setSuccessMessage("Access granted...");

  // ✅ Update last login
  await updateDoc(doc(db, "users", uid), {
    lastLoginAt: serverTimestamp(),
  });

  // ✅ Log activity
  await addDoc(collection(db, "user_activity"), {
    uid,
    type: "AUTH",
    action: "USER_LOGIN",
    timestamp: serverTimestamp(),
  });

  navigate("/");
  return;
}

      }
    } catch (error) {
      if (error.message === "NOT_ADMIN") {
        setErrorMessage("Access denied. Admin account not found or inactive.");
      } else if (error.message === "NOT_USER") {
        setErrorMessage("Access denied. User account not found or inactive.");
      } else {
        setErrorMessage(formatFirebaseError(error.code));
      }
      setIsLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTER HANDLER - Creates normal user only (User Mode only)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setErrorMessage("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // 🔐 ADMIN MODE → admins collection
      if (isAdmin) {
        await setDoc(doc(db, "admins", uid), {
          email,
          role: "admin",
          active: true,
          createdAt: serverTimestamp(),
        });

        setSuccessMessage("Admin account created...");
        setTimeout(() => navigate("/admin"), 1000);
        return;
      }

      // 👤 USER MODE → users collection
      await setDoc(doc(db, "users", uid), {
        email,
        role: "user",
        active: true,
        createdAt: serverTimestamp(),
      });

      setSuccessMessage("Registration complete...");
      setTimeout(() => navigate("/"), 1000);
    } catch (error) {
      console.error(error);
      setErrorMessage(formatFirebaseError(error.code));
      setIsLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD HANDLER
  // ═══════════════════════════════════════════════════════════════════════════
  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMessage("Enter your email to reset password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("Reset email sent. Check your inbox.");
    } catch (error) {
      setErrorMessage(formatFirebaseError(error.code));
    } finally {
      setIsLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR FORMATTER
  // ═══════════════════════════════════════════════════════════════════════════
  const formatFirebaseError = (code) => {
    const errors = {
      "auth/invalid-email": "Invalid email format.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Invalid email or password.",
      "auth/email-already-in-use": "Email already registered.",
      "auth/weak-password": "Password is too weak.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
    };
    return errors[code] || "An error occurred. Please try again.";
  };

  // Toggle admin mode handler
  const handleAdminToggle = () => {
    setIsAdmin(!isAdmin);
    setIsRegister(false); // Reset to login when switching modes
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      isRegister ? handleRegister() : handleLogin();
    }
  };

  return (
    <div className="login-container">
      {/* Paper Texture */}
      <div className="paper-texture" />

      {/* Decorative Ink Splatters */}
      <svg className="ink-splatter top-left" viewBox="0 0 100 100">
        <circle cx="15" cy="15" r="20" fill="var(--cinnabar)" opacity="0.08" />
        <circle cx="35" cy="25" r="10" fill="var(--cinnabar)" opacity="0.06" />
        <circle cx="20" cy="40" r="6" fill="var(--cinnabar)" opacity="0.04" />
      </svg>

      <svg className="ink-splatter top-right" viewBox="0 0 100 100">
        <circle cx="85" cy="20" r="15" fill="var(--indigo)" opacity="0.07" />
        <circle cx="70" cy="35" r="8" fill="var(--indigo)" opacity="0.05" />
      </svg>

      <svg className="ink-splatter bottom-left" viewBox="0 0 100 100">
        <circle cx="20" cy="80" r="12" fill="var(--indigo)" opacity="0.06" />
        <circle cx="35" cy="70" r="6" fill="var(--indigo)" opacity="0.04" />
      </svg>

      <svg className="ink-splatter bottom-right" viewBox="0 0 100 100">
        <circle cx="80" cy="85" r="18" fill="var(--cinnabar)" opacity="0.07" />
        <circle cx="65" cy="75" r="8" fill="var(--cinnabar)" opacity="0.05" />
      </svg>

      {/* Main Content */}
      <main className={`login-content ${isLoaded ? "loaded" : ""}`}>
        {/* Header */}
        <header className="login-header">
          <div className="logo-section">
            <div className={`hanko-stamp ${isAdmin ? "admin-mode" : ""}`}>
              <span>FT</span>
            </div>
          </div>
          <div className="title-section">
            <span className="title-accent">AI Driven Sketch Creator</span>
            <h1 className="title-main">FACE TRACE</h1>
            <div className="title-underline" />
          </div>
        </header>

        {/* Login Panel */}
        <section className={`manga-panel login-panel ${isAdmin ? "admin-panel" : ""}`}>
          <div className="panel-corners">
            <div className="corner top-left" />
            <div className="corner top-right" />
            <div className="corner bottom-left" />
            <div className="corner bottom-right" />
          </div>

          {/* Panel Header */}
          <div className="panel-header">
            <span className="panel-number">
              {isAdmin ? "A1" : isRegister ? "02" : "01"}
            </span>
            <h2>
              {isAdmin
                ? "Admin Authentication"
                : isRegister
                ? "Create Account"
                : "User Authentication"}
            </h2>

            {/* Admin Toggle Button */}
            <button
              onClick={handleAdminToggle}
              className={`admin-toggle-btn ${isAdmin ? "active" : ""}`}
              title={isAdmin ? "Switch to User Mode" : "Switch to Admin Mode"}
              disabled={isLoading}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>{isAdmin ? "ADMIN" : "USER"}</span>
            </button>
          </div>

          {/* Admin Mode Indicator */}
          {isAdmin && (
            <div className="admin-indicator">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>Admin accounts must be created manually in Firebase Console</span>
            </div>
          )}

          {/* Form */}
          <div className="form-content">
            {/* Email Field */}
            <div className="input-group">
              <label className="input-label">
                <span className="label-text">Email</span>
                <span className="label-line" />
              </label>
              <div className="input-field">
                <div className="input-icon-box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <input
                  type="email"
                  className="neo-input"
                  placeholder={isAdmin ? "Enter admin email" : "Enter your email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="input-group">
              <label className="input-label">
                <span className="label-text">Password</span>
                <span className="label-line" />
              </label>
              <div className="input-field">
                <div className="input-icon-box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </div>
                <input
                  type="password"
                  className="neo-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Confirm Password (Register Only - User Mode) */}
            {isRegister && !isAdmin && (
              <div className="input-group slide-in">
                <label className="input-label">
                  <span className="label-text">Confirm Password</span>
                  <span className="label-line" />
                </label>
                <div className="input-field">
                  <div className="input-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    className="neo-input"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="message-box error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="message-box success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              className={`submit-button ${isLoading ? "loading" : ""} ${isAdmin ? "admin-btn" : ""}`}
              onClick={isRegister ? handleRegister : handleLogin}
              disabled={isLoading}
            >
              <span className="button-text">
                {isLoading
                  ? "PROCESSING..."
                  : isAdmin
                  ? "ADMIN LOGIN"
                  : isRegister
                  ? "CREATE ACCOUNT"
                  : "INITIALIZE NEURAL INTERFACE"}
              </span>
              {isLoading && <div className="button-loader" />}
            </button>

            {/* Forgot Password (Login Only) */}
            {!isRegister && (
              <button
                className="forgot-password-btn"
                onClick={handleForgotPassword}
                disabled={isLoading}
              >
                Forgot Password?
              </button>
            )}
          </div>

          {/* Mode Toggle - Only show in User Mode */}
          {!isAdmin && (
            <div className="mode-toggle">
              <div className="toggle-divider">
                <span className="divider-line" />
                <span className="divider-text">OR</span>
                <span className="divider-line" />
              </div>

              <div className="toggle-section">
                <span className="toggle-label">
                  {isRegister ? "Already have an account?" : "New to the system?"}
                </span>
                <button
                  className="toggle-button"
                  onClick={() => setIsRegister(!isRegister)}
                  disabled={isLoading}
                >
                  <span>{isRegister ? "SIGN IN" : "REGISTER"}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="login-footer">
          <div className="footer-line">
            <span className="line" />
            <div className="footer-emblem">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="line" />
          </div>
          <p className="footer-text">Forensic AI System v1.0</p>
        </footer>
      </main>

      <style>{`
        /* ═══════════════════════════════════════
           NEO-EDO LOGIN - WITH ADMIN TOGGLE
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
          --admin-primary: #6B21A8;
          --admin-light: #A855F7;
          --admin-dark: #581C87;

          --font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --border-thick: 3px;
          --border-thin: 1.5px;
          --transition-snap: cubic-bezier(0.68, -0.55, 0.265, 1.55);
          --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
          --shadow-hard: 4px 4px 0 var(--ink);
        }

        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* ═══════════════════════════════════════
           CONTAINER
        ═══════════════════════════════════════ */

        .login-container {
          min-height: 100vh;
          background: var(--parchment);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
          overflow: hidden;
          font-family: var(--font-main);
        }

        .paper-texture {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.3;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
        }

        .ink-splatter {
          position: fixed;
          width: 200px;
          height: 200px;
          pointer-events: none;
          z-index: 0;
        }

        .ink-splatter.top-left { top: 0; left: 0; }
        .ink-splatter.top-right { top: 0; right: 0; }
        .ink-splatter.bottom-left { bottom: 0; left: 0; }
        .ink-splatter.bottom-right { bottom: 0; right: 0; }

        /* ═══════════════════════════════════════
           MAIN CONTENT
        ═══════════════════════════════════════ */

        .login-content {
          width: 100%;
          max-width: 440px;
          position: relative;
          z-index: 1;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.6s var(--transition-smooth);
        }

        .login-content.loaded {
          opacity: 1;
          transform: translateY(0);
        }

        /* ═══════════════════════════════════════
           HEADER
        ═══════════════════════════════════════ */

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .logo-section {
          margin-bottom: 1.25rem;
        }

        .hanko-stamp {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 70px;
          height: 70px;
          background: var(--cinnabar);
          border: 3px solid var(--cinnabar-dark);
          border-radius: 4px;
          transform: rotate(-5deg);
          position: relative;
          animation: stampAppear 0.6s var(--transition-snap) 0.2s backwards;
          box-shadow: 2px 2px 0 var(--cinnabar-dark);
          transition: all 0.3s var(--transition-smooth);
        }

        .hanko-stamp.admin-mode {
          background: var(--admin-primary);
          border-color: var(--admin-dark);
          box-shadow: 2px 2px 0 var(--admin-dark);
        }

        @keyframes stampAppear {
          from {
            opacity: 0;
            transform: rotate(-5deg) scale(0.5);
          }
          to {
            opacity: 1;
            transform: rotate(-5deg) scale(1);
          }
        }

        .hanko-stamp::before {
          content: '';
          position: absolute;
          inset: 4px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }

        .hanko-stamp span {
          font-family: var(--font-main);
          font-size: 1.5rem;
          font-weight: 900;
          color: var(--parchment);
          letter-spacing: 0.1em;
        }

        .title-section {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .title-accent {
          font-family: var(--font-main);
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--cinnabar);
          letter-spacing: 0.4em;
          text-transform: uppercase;
          margin-bottom: 0.35rem;
        }

        .title-main {
          font-family: var(--font-main);
          font-size: 1.85rem;
          font-weight: 900;
          color: var(--ink);
          letter-spacing: 0.08em;
          line-height: 1;
        }

        .title-underline {
          width: 80px;
          height: 4px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            var(--cinnabar) 15%, 
            var(--cinnabar) 85%, 
            transparent 100%
          );
          margin-top: 1rem;
          animation: brushStroke 0.8s var(--transition-snap) 0.4s backwards;
          transform-origin: left;
          border-radius: 2px;
        }

        @keyframes brushStroke {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        /* ═══════════════════════════════════════
           MANGA PANEL
        ═══════════════════════════════════════ */

        .manga-panel {
          background: var(--parchment-light);
          border: var(--border-thick) solid var(--ink);
          padding: 2rem;
          position: relative;
          transition: all 0.3s var(--transition-smooth);
        }

        .manga-panel.admin-panel {
          border-color: var(--admin-primary);
        }

        .manga-panel.admin-panel .panel-corners .corner {
          border-color: var(--admin-light);
        }

        .manga-panel::before {
          content: '';
          position: absolute;
          inset: 6px;
          border: var(--border-thin) solid var(--ink);
          pointer-events: none;
          opacity: 0.12;
        }

        .manga-panel:hover {
          transform: translate(-2px, -2px);
          box-shadow: var(--shadow-hard);
        }

        .manga-panel.admin-panel:hover {
          box-shadow: 4px 4px 0 var(--admin-primary);
        }

        .panel-corners .corner {
          position: absolute;
          width: 15px;
          height: 15px;
          border-color: var(--cinnabar);
          border-style: solid;
          opacity: 0.6;
          transition: border-color 0.3s;
        }

        .panel-corners .corner.top-left {
          top: -1px;
          left: -1px;
          border-width: 3px 0 0 3px;
        }

        .panel-corners .corner.top-right {
          top: -1px;
          right: -1px;
          border-width: 3px 3px 0 0;
        }

        .panel-corners .corner.bottom-left {
          bottom: -1px;
          left: -1px;
          border-width: 0 0 3px 3px;
        }

        .panel-corners .corner.bottom-right {
          bottom: -1px;
          right: -1px;
          border-width: 0 3px 3px 0;
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          margin-bottom: 1.75rem;
          padding-bottom: 0.85rem;
          border-bottom: 2px solid var(--ink);
          flex-wrap: wrap;
        }

        .panel-number {
          font-family: var(--font-main);
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--parchment);
          background: var(--ink);
          padding: 0.3rem 0.6rem;
          letter-spacing: 0.05em;
          transition: background 0.3s;
        }

        .admin-panel .panel-number {
          background: var(--admin-primary);
        }

        .panel-header h2 {
          font-family: var(--font-main);
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0;
          flex: 1;
        }

        /* ═══════════════════════════════════════
           ADMIN TOGGLE BUTTON
        ═══════════════════════════════════════ */

        .admin-toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          background: transparent;
          border: 2px solid var(--indigo);
          color: var(--indigo);
          cursor: pointer;
          transition: all 0.25s ease;
          text-transform: uppercase;
        }

        .admin-toggle-btn svg {
          width: 14px;
          height: 14px;
        }

        .admin-toggle-btn:hover:not(:disabled) {
          background: var(--indigo);
          color: var(--parchment);
        }

        .admin-toggle-btn.active {
          background: var(--admin-primary);
          border-color: var(--admin-primary);
          color: white;
        }

        .admin-toggle-btn.active:hover:not(:disabled) {
          background: var(--admin-dark);
          border-color: var(--admin-dark);
        }

        .admin-toggle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ═══════════════════════════════════════
           ADMIN INDICATOR
        ═══════════════════════════════════════ */

        .admin-indicator {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          margin-bottom: 1.25rem;
          background: rgba(107, 33, 168, 0.08);
          border: 1px solid var(--admin-light);
          border-left: 4px solid var(--admin-primary);
          font-size: 0.7rem;
          color: var(--admin-dark);
          animation: slideIn 0.3s ease;
        }

        .admin-indicator svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          color: var(--admin-primary);
        }

        .admin-indicator span {
          line-height: 1.4;
        }

        /* ═══════════════════════════════════════
           FORM ELEMENTS
        ═══════════════════════════════════════ */

        .form-content {
          display: flex;
          flex-direction: column;
          gap: 1.35rem;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .input-group.slide-in {
          animation: slideIn 0.3s var(--transition-snap);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .input-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .label-text {
          font-family: var(--font-main);
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .label-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, var(--ink-muted) 0%, transparent 100%);
          opacity: 0.2;
        }

        .input-field {
          display: flex;
          align-items: stretch;
          border: 2px solid var(--ink);
          background: var(--parchment);
          transition: all 0.25s var(--transition-smooth);
        }

        .admin-panel .input-field:focus-within {
          border-color: var(--admin-primary);
          box-shadow: 0 0 0 3px rgba(107, 33, 168, 0.1);
        }

        .input-field:focus-within {
          border-color: var(--cinnabar);
          box-shadow: 0 0 0 3px rgba(179, 58, 58, 0.1);
        }

        .input-icon-box {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          min-width: 50px;
          background: var(--parchment-dark);
          border-right: 2px solid var(--ink);
          transition: all 0.25s var(--transition-smooth);
        }

        .input-field:focus-within .input-icon-box {
          background: rgba(179, 58, 58, 0.1);
          border-right-color: var(--cinnabar);
        }

        .admin-panel .input-field:focus-within .input-icon-box {
          background: rgba(107, 33, 168, 0.1);
          border-right-color: var(--admin-primary);
        }

        .input-icon-box svg {
          width: 20px;
          height: 20px;
          color: var(--ink-muted);
          transition: color 0.25s;
        }

        .input-field:focus-within .input-icon-box svg {
          color: var(--cinnabar);
        }

        .admin-panel .input-field:focus-within .input-icon-box svg {
          color: var(--admin-primary);
        }

        .neo-input {
          flex: 1;
          width: 100%;
          padding: 1rem 1rem;
          background: transparent;
          border: none;
          font-family: var(--font-main);
          font-size: 0.95rem;
          color: var(--ink);
          outline: none;
        }

        .neo-input::placeholder {
          color: var(--ink-muted);
          opacity: 0.5;
          font-size: 0.85rem;
        }

        .neo-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: var(--parchment-dark);
        }

        /* ═══════════════════════════════════════
           MESSAGE BOXES
        ═══════════════════════════════════════ */

        .message-box {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          border: 2px solid;
          font-family: var(--font-main);
          font-size: 0.8rem;
          font-weight: 500;
          line-height: 1.4;
          animation: messageAppear 0.3s var(--transition-snap);
        }

        @keyframes messageAppear {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message-box svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .message-box.error {
          background: rgba(179, 58, 58, 0.08);
          border-color: var(--cinnabar);
          color: var(--cinnabar-dark);
        }

        .message-box.success {
          background: rgba(42, 157, 143, 0.08);
          border-color: var(--indigo-light);
          color: var(--indigo);
        }

        /* ═══════════════════════════════════════
           BUTTONS
        ═══════════════════════════════════════ */

        .submit-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          padding: 1.1rem 1.5rem;
          background: var(--ink);
          border: var(--border-thick) solid var(--ink);
          color: var(--parchment);
          font-family: var(--font-main);
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.25s var(--transition-snap);
          margin-top: 0.5rem;
        }

        .submit-button.admin-btn {
          background: var(--admin-primary);
          border-color: var(--admin-primary);
        }

        .submit-button.admin-btn:hover:not(:disabled) {
          background: var(--admin-dark);
          box-shadow: 0 5px 0 var(--admin-dark);
        }

        .submit-button.admin-btn::after {
          background: var(--admin-light);
        }

        .submit-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          transition: left 0.5s;
        }

        .submit-button:hover:not(:disabled)::before {
          left: 100%;
        }

        .submit-button::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: var(--sunflower);
          transform: scaleX(0);
          transform-origin: right;
          transition: transform 0.3s var(--transition-smooth);
        }

        .submit-button:hover:not(:disabled)::after {
          transform: scaleX(1);
          transform-origin: left;
        }

        .submit-button:hover:not(:disabled) {
          background: var(--ink-light);
          transform: translateY(-3px);
          box-shadow: 0 5px 0 var(--ink);
        }

        .submit-button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: none;
        }

        .submit-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .submit-button.loading {
          pointer-events: none;
        }

        .button-loader {
          width: 18px;
          height: 18px;
          border: 2px solid var(--parchment);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .forgot-password-btn {
          align-self: center;
          background: none;
          border: none;
          color: var(--indigo);
          font-family: var(--font-main);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          padding: 0.5rem 1rem;
          transition: all 0.2s;
          position: relative;
        }

        .forgot-password-btn::after {
          content: '';
          position: absolute;
          bottom: 6px;
          left: 1rem;
          right: 1rem;
          height: 1px;
          background: var(--indigo);
          opacity: 0.4;
          transition: opacity 0.2s;
        }

        .forgot-password-btn:hover:not(:disabled) {
          color: var(--indigo-light);
        }

        .forgot-password-btn:hover:not(:disabled)::after {
          opacity: 0.8;
          background: var(--indigo-light);
        }

        .forgot-password-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ═══════════════════════════════════════
           MODE TOGGLE
        ═══════════════════════════════════════ */

        .mode-toggle {
          margin-top: 1.75rem;
          padding-top: 1.5rem;
        }

        .toggle-divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .divider-line {
          flex: 1;
          height: 2px;
          background: var(--ink);
          opacity: 0.1;
        }

        .divider-text {
          font-family: var(--font-main);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--ink-muted);
          letter-spacing: 0.2em;
        }

        .toggle-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.85rem;
        }

        .toggle-label {
          font-family: var(--font-main);
          font-size: 0.8rem;
          color: var(--ink-muted);
        }

        .toggle-button {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.7rem 1.5rem;
          background: transparent;
          border: 2px solid var(--cinnabar);
          color: var(--cinnabar);
          font-family: var(--font-main);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          cursor: pointer;
          transition: all 0.25s var(--transition-snap);
        }

        .toggle-button svg {
          width: 16px;
          height: 16px;
          transition: transform 0.25s var(--transition-snap);
        }

        .toggle-button:hover:not(:disabled) {
          background: var(--cinnabar);
          color: var(--parchment);
          transform: translateX(4px);
        }

        .toggle-button:hover:not(:disabled) svg {
          transform: translateX(3px);
        }

        .toggle-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ═══════════════════════════════════════
           FOOTER
        ═══════════════════════════════════════ */

        .login-footer {
          margin-top: 2.5rem;
          text-align: center;
        }

        .footer-line {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.25rem;
          margin-bottom: 0.85rem;
        }

        .footer-line .line {
          width: 50px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--ink-muted), transparent);
          opacity: 0.3;
        }

        .footer-emblem {
          width: 28px;
          height: 28px;
          color: var(--cinnabar);
          opacity: 0.5;
        }

        .footer-emblem svg {
          width: 100%;
          height: 100%;
        }

        .footer-text {
          font-family: var(--font-main);
          font-size: 0.65rem;
          color: var(--ink-muted);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          opacity: 0.5;
        }

        /* ═══════════════════════════════════════
           RESPONSIVE
        ═══════════════════════════════════════ */

        @media (max-width: 480px) {
          .login-container {
            padding: 1.25rem;
          }

          .login-content {
            max-width: 100%;
          }

          .manga-panel {
            padding: 1.5rem;
          }

          .title-main {
            font-size: 1.5rem;
            letter-spacing: 0.05em;
          }

          .title-accent {
            font-size: 0.6rem;
            letter-spacing: 0.3em;
          }

          .hanko-stamp {
            width: 60px;
            height: 60px;
          }

          .hanko-stamp span {
            font-size: 1.25rem;
          }

          .submit-button {
            padding: 1rem 1.25rem;
            font-size: 0.75rem;
          }

          .neo-input {
            padding: 0.85rem 0.85rem;
            font-size: 0.9rem;
          }

          .input-icon-box {
            width: 44px;
            min-width: 44px;
          }

          .input-icon-box svg {
            width: 18px;
            height: 18px;
          }

          .panel-header {
            gap: 0.5rem;
          }

          .panel-header h2 {
            font-size: 0.7rem;
            flex-basis: 100%;
            order: 3;
            margin-top: 0.5rem;
          }

          .admin-toggle-btn {
            padding: 4px 8px;
            font-size: 0.55rem;
          }

          .admin-indicator {
            font-size: 0.65rem;
            padding: 0.6rem 0.8rem;
          }
        }

        /* ═══════════════════════════════════════
           REDUCED MOTION
        ═══════════════════════════════════════ */

        @media (prefers-reduced-motion: reduce) {
          .login-content {
            opacity: 1;
            transform: none;
            transition: none;
          }

          .hanko-stamp {
            animation: none;
          }

          .title-underline {
            animation: none;
            transform: scaleX(1);
          }

          .message-box,
          .input-group.slide-in,
          .admin-indicator {
            animation: none;
          }

          .button-loader {
            animation: none;
          }

          .submit-button::before {
            display: none;
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
      `}</style>
    </div>
  );
}