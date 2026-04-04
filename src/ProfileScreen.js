// src/ProfileScreen.js
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { CheckCircle, XCircle, Layers } from "lucide-react";

import backIcon from "./assets/back.png";
import badgeIcon from "./assets/badge.png";
import closeIcon from "./assets/close.png";
import departmentIcon from "./assets/department.png";
import phoneIcon from "./assets/phone.png";
import profileIcon from "./assets/profile.png";
import resetpassIcon from "./assets/resetpass.png";
import saveIcon from "./assets/save.png";
import logoutIcon from "./assets/logout.png";

function ProfileScreen() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [profile, setProfile] = useState({
    displayName: "",
    phone: "",
    department: "",
    badgeNumber: "",
    bio: "",
    preferredStyle: "pencil_sketch",
    autoSave: true,
    theme: "light",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState({ type: "", text: "" });
  const [passwordMessage, setPasswordMessage] = useState({
    type: "",
    text: "",
  });

  const navigate = useNavigate();

  const fetchProfile = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        navigate("/");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfile({
          displayName: data.displayName || "",
          phone: data.phone || "",
          department: data.department || "",
          badgeNumber: data.badgeNumber || "",
          bio: data.bio || "",
          preferredStyle: data.preferredStyle || "pencil_sketch",
          autoSave: data.autoSave ?? true,
          theme: data.theme || "light",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setMessage({ type: "error", text: "Failed to load profile data." });
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    setIsLoaded(true);
    fetchProfile();
  }, [fetchProfile]);

  const handleInputChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const user = auth.currentUser;
      if (!user) {
        navigate("/");
        return;
      }
      await updateDoc(doc(db, "users", user.uid), {
        displayName: profile.displayName,
        phone: profile.phone,
        department: profile.department,
        badgeNumber: profile.badgeNumber,
        bio: profile.bio,
        preferredStyle: profile.preferredStyle,
        autoSave: profile.autoSave,
        theme: profile.theme,
        updatedAt: serverTimestamp(),
      });
      setMessage({ type: "success", text: "Profile updated successfully!" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
      setMessage({
        type: "error",
        text: "Failed to save profile. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage({ type: "", text: "" });
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPasswordMessage({ type: "error", text: "All fields are required." });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New passwords do not match.",
      });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 6 characters.",
      });
      return;
    }
    setIsChangingPassword(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordData.currentPassword
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordData.newPassword);
      setPasswordMessage({
        type: "success",
        text: "Password changed successfully!",
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMessage({ type: "", text: "" });
      }, 2000);
    } catch (error) {
      console.error("Password change error:", error);
      if (error.code === "auth/wrong-password") {
        setPasswordMessage({
          type: "error",
          text: "Current password is incorrect.",
        });
      } else {
        setPasswordMessage({
          type: "error",
          text: "Failed to change password. Please try again.",
        });
      }
    } finally {
      setIsChangingPassword(false);
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

  if (isLoading) {
    return (
      <div className="profile-container">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <span>Loading profile...</span>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="paper-texture" />

      <svg className="ink-splatter top-left" viewBox="0 0 100 100">
        <circle
          cx="15"
          cy="15"
          r="20"
          fill="var(--cinnabar)"
          opacity="0.08"
        />
        <circle
          cx="35"
          cy="25"
          r="10"
          fill="var(--cinnabar)"
          opacity="0.06"
        />
      </svg>
      <svg className="ink-splatter bottom-right" viewBox="0 0 100 100">
        <circle
          cx="80"
          cy="85"
          r="18"
          fill="var(--indigo)"
          opacity="0.07"
        />
        <circle
          cx="65"
          cy="75"
          r="8"
          fill="var(--indigo)"
          opacity="0.05"
        />
      </svg>

      {/* ═══ NAVIGATION ═══ */}
      <nav className="top-nav">
        <div className="nav-left-group">
          <button className="nav-back-btn" onClick={() => navigate("/home")}>
            <img src={backIcon} alt="Back" className="crisp-icon" />
            <span>Back</span>
          </button>
          <span className="nav-sep" />
          <span className="nav-page-label">Profile Settings</span>
        </div>

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
      </nav>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowPasswordModal(false)}
        >
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
                onClick={() => setShowPasswordModal(false)}
              >
                <img src={closeIcon} alt="Close" className="crisp-icon" />
              </button>
              <div className="modal-header">
                <span className="panel-number pw-badge">PW</span>
                <h2>Change Password</h2>
              </div>
              <div className="modal-body">
                <div className="input-group">
                  <label className="input-label">
                    <span className="label-text">Current Password</span>
                    <span className="label-line" />
                  </label>
                  <div className="input-field">
                    <div className="input-icon-box">
                      <img
                        src={resetpassIcon}
                        alt="Password"
                        className="crisp-icon field-icon"
                      />
                    </div>
                    <input
                      type="password"
                      className="neo-input"
                      placeholder="Enter current password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData((prev) => ({
                          ...prev,
                          currentPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">
                    <span className="label-text">New Password</span>
                    <span className="label-line" />
                  </label>
                  <div className="input-field">
                    <div className="input-icon-box">
                      <img
                        src={badgeIcon}
                        alt="Badge"
                        className="crisp-icon field-icon"
                      />
                    </div>
                    <input
                      type="password"
                      className="neo-input"
                      placeholder="Enter new password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">
                    <span className="label-text">Confirm New Password</span>
                    <span className="label-line" />
                  </label>
                  <div className="input-field">
                    <div className="input-icon-box">
                      <img
                        src={resetpassIcon}
                        alt="Confirm"
                        className="crisp-icon field-icon"
                      />
                    </div>
                    <input
                      type="password"
                      className="neo-input"
                      placeholder="Confirm new password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                {passwordMessage.text && (
                  <div className={`message-box ${passwordMessage.type}`}>
                    {passwordMessage.type === "success" ? (
                      <CheckCircle size={18} />
                    ) : (
                      <XCircle size={18} />
                    )}
                    <span>{passwordMessage.text}</span>
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    className="modal-btn secondary"
                    onClick={() => setShowPasswordModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="modal-btn primary"
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <>
                        <div className="btn-loader" />
                        <span>Changing...</span>
                      </>
                    ) : (
                      <span>Change Password</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`profile-content ${isLoaded ? "loaded" : ""}`}>
        {/* Profile Header */}
        <header className="profile-header">
          <div className="profile-avatar">
            <div className="avatar-inner">
              <img
                src={profileIcon}
                alt="Profile"
                className="crisp-icon avatar-icon"
              />
            </div>
            <div className="avatar-badge">
              <img
                src={badgeIcon}
                alt="Badge"
                className="crisp-icon badge-sm-icon"
              />
            </div>
          </div>
          <div className="profile-info">
            <h1 className="profile-name">
              {profile.displayName || "User"}
            </h1>
            <p className="profile-email">{auth.currentUser?.email}</p>
          </div>
        </header>

        {/* Profile Form Panel */}
        <section className="manga-panel profile-panel">
          <div className="panel-corners">
            <div className="corner top-left" />
            <div className="corner top-right" />
            <div className="corner bottom-left" />
            <div className="corner bottom-right" />
          </div>
          <div className="panel-header">
            <span className="panel-number">01</span>
            <h2>Personal Information</h2>
          </div>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">
                <span className="label-text">Display Name</span>
                <span className="label-line" />
              </label>
              <div className="input-field">
                <div className="input-icon-box">
                  <img
                    src={profileIcon}
                    alt="User"
                    className="crisp-icon field-icon"
                  />
                </div>
                <input
                  type="text"
                  className="neo-input"
                  placeholder="Enter your name"
                  value={profile.displayName}
                  onChange={(e) =>
                    handleInputChange("displayName", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">
                <span className="label-text">Phone Number</span>
                <span className="label-line" />
              </label>
              <div className="input-field">
                <div className="input-icon-box">
                  <img
                    src={phoneIcon}
                    alt="Phone"
                    className="crisp-icon field-icon"
                  />
                </div>
                <input
                  type="tel"
                  className="neo-input"
                  placeholder="Enter phone number"
                  value={profile.phone}
                  onChange={(e) =>
                    handleInputChange("phone", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">
                <span className="label-text">Department</span>
                <span className="label-line" />
              </label>
              <div className="input-field">
                <div className="input-icon-box">
                  <img
                    src={departmentIcon}
                    alt="Department"
                    className="crisp-icon field-icon"
                  />
                </div>
                <input
                  type="text"
                  className="neo-input"
                  placeholder="Enter department"
                  value={profile.department}
                  onChange={(e) =>
                    handleInputChange("department", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">
                <span className="label-text">Badge Number</span>
                <span className="label-line" />
              </label>
              <div className="input-field">
                <div className="input-icon-box">
                  <img
                    src={badgeIcon}
                    alt="Badge"
                    className="crisp-icon field-icon"
                  />
                </div>
                <input
                  type="text"
                  className="neo-input"
                  placeholder="Enter badge number"
                  value={profile.badgeNumber}
                  onChange={(e) =>
                    handleInputChange("badgeNumber", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
          <div className="input-group full-width">
            <label className="input-label">
              <span className="label-text">Bio</span>
              <span className="label-line" />
            </label>
            <textarea
              className="neo-textarea"
              placeholder="Tell us about yourself..."
              value={profile.bio}
              onChange={(e) => handleInputChange("bio", e.target.value)}
              rows={4}
            />
          </div>
          {message.text && (
            <div className={`message-box ${message.type}`}>
              {message.type === "success" ? (
                <CheckCircle size={18} />
              ) : (
                <XCircle size={18} />
              )}
              <span>{message.text}</span>
            </div>
          )}
          <div className="form-actions">
            <button
              className="action-btn secondary"
              onClick={() => setShowPasswordModal(true)}
            >
              <img
                src={resetpassIcon}
                alt="Password"
                className="crisp-icon action-icon-dark"
              />
              <span>Change Password</span>
            </button>
            <button
              className="action-btn primary"
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="btn-loader" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <img
                    src={saveIcon}
                    alt="Save"
                    className="crisp-icon inverted"
                  />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Customization Panel */}
        <section className="manga-panel customization-panel">
          <div className="panel-corners">
            <div className="corner top-left" />
            <div className="corner top-right" />
            <div className="corner bottom-left" />
            <div className="corner bottom-right" />
          </div>
          <div className="panel-header">
            <span className="panel-number">02</span>
            <h2>Account Preferences</h2>
          </div>
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">
                <span className="label-text">Preferred Sketch Style</span>
                <span className="label-line" />
              </label>
              <select 
                className="neo-select"
                value={profile.preferredStyle}
                onChange={(e) => handleInputChange("preferredStyle", e.target.value)}
              >
                <option value="pencil_sketch">Pencil Sketch (Traditional)</option>
                <option value="realistic_photo">Realistic Photo (Modern)</option>
                <option value="gan_hq">High Fidelity (AI Optimized)</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">
                <span className="label-text">Interface Theme</span>
                <span className="label-line" />
              </label>
              <select 
                className="neo-select"
                value={profile.theme}
                onChange={(e) => handleInputChange("theme", e.target.value)}
              >
                <option value="light">Classic Parchment</option>
                <option value="dark">Antique Ink (Dark)</option>
                <option value="sepia">Vintage Sepia</option>
              </select>
            </div>
            <div className="input-group checkbox-group">
              <label className="checkbox-container">
                <input 
                  type="checkbox"
                  checked={profile.autoSave}
                  onChange={(e) => handleInputChange("autoSave", e.target.checked)}
                />
                <span className="checkmark" />
                <span className="checkbox-label">Auto-save witness statements to local cache</span>
              </label>
            </div>
          </div>
          <div className="form-actions">
             <button
              className="action-btn primary"
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="btn-loader" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <img
                    src={saveIcon}
                    alt="Save"
                    className="crisp-icon inverted"
                  />
                  <span>Save Preferences</span>
                </>
              )}
            </button>
          </div>
        </section>

        <footer className="profile-footer">
          <div className="footer-line">
            <span className="line" />
            <div className="footer-emblem">
              <Layers size={28} />
            </div>
            <span className="line" />
          </div>
          <p className="footer-text">Forensic AI System v1.0</p>
        </footer>
      </main>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
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
    --font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --border-thick: 3px;
    --border-thin: 1.5px;
    --radius-sm: 3px;
    --radius-md: 6px;
    --transition-snap: cubic-bezier(0.68, -0.55, 0.265, 1.55);
    --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
    --shadow-hard: 4px 4px 0 var(--ink);
    --shadow-soft: 0 4px 20px rgba(26, 26, 46, 0.1);
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
                opacity 0.2s var(--transition-smooth),
                filter 0.2s var(--transition-smooth);
    opacity: 0.85;
  }

  .crisp-icon.inverted {
    filter: brightness(0) saturate(100%) invert(100%);
    opacity: 0.95;
  }

  .crisp-icon.action-icon-dark {
    filter: brightness(0) saturate(100%);
    opacity: 0.7;
  }

  /* Size variants */
  .crisp-icon.nav-icon-size {
    width: 22px !important;
    height: 22px !important;
    opacity: 0.6;
    filter: brightness(0) saturate(100%);
  }

  .crisp-icon.field-icon {
    width: 18px !important;
    height: 18px !important;
    opacity: 0.55;
    filter: brightness(0) saturate(100%) invert(20%) sepia(15%) saturate(1500%) hue-rotate(155deg) brightness(95%) contrast(95%);
  }

  .crisp-icon.avatar-icon {
    width: 50px !important;
    height: 50px !important;
    opacity: 0.6;
    filter: brightness(0) saturate(100%);
  }

  .crisp-icon.badge-sm-icon {
    width: 16px !important;
    height: 16px !important;
    opacity: 1;
    filter: brightness(0) saturate(100%) invert(100%);
  }

  /* ═══════════════════════════════════════
     CONTAINER & TEXTURE
  ═══════════════════════════════════════ */
  .profile-container {
    min-height: 100vh;
    background: var(--parchment);
    background-image:
      radial-gradient(ellipse at 20% 50%, rgba(38, 70, 83, 0.03) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(179, 58, 58, 0.03) 0%, transparent 50%);
    position: relative;
    overflow-x: hidden;
    padding: 2rem;
    padding-top: 5.5rem;
    font-family: var(--font-main);
  }

  .paper-texture {
    position: fixed; inset: 0; pointer-events: none; opacity: 0.25;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    mix-blend-mode: multiply;
  }

  .ink-splatter { position: fixed; width: 200px; height: 200px; pointer-events: none; z-index: 0; }
  .ink-splatter.top-left { top: 0; left: 0; }
  .ink-splatter.bottom-right { bottom: 0; right: 0; }

  /* Loading */
  .loading-screen {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 1rem;
  }
  .loading-spinner {
    width: 40px; height: 40px;
    border: 3px solid var(--parchment-dark); border-top-color: var(--cinnabar);
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-screen span { color: var(--ink-muted); font-size: 0.9rem; }

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

  .nav-left-group {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .nav-back-btn {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--ink);
    font-family: var(--font-main);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s var(--transition-smooth);
    opacity: 0.55;
    letter-spacing: 0.03em;
    position: relative;
  }

  .nav-back-btn:hover {
    opacity: 1;
    background: rgba(26, 26, 46, 0.06);
    transform: translateY(-1px);
  }

  .nav-back-btn:active {
    transform: translateY(0);
    background: rgba(26, 26, 46, 0.1);
  }

  .nav-back-btn::after {
    content: '';
    position: absolute;
    bottom: 2px; left: 50%;
    width: 0; height: 2px;
    border-radius: 1px;
    background: var(--indigo);
    transition: all 0.3s var(--transition-smooth);
    transform: translateX(-50%);
  }

  .nav-back-btn:hover::after { width: 70%; }

  .nav-back-btn .crisp-icon {
    opacity: 0.65;
    filter: brightness(0) saturate(100%);
  }

  .nav-back-btn:hover .crisp-icon {
    opacity: 1;
    transform: translateX(-2px);
  }

  .nav-sep {
    width: 1px;
    height: 18px;
    background: var(--ink);
    opacity: 0.1;
  }

  .nav-page-label {
    font-size: 0.65rem;
    font-weight: 800;
    color: var(--ink);
    letter-spacing: 0.18em;
    opacity: 0.3;
    text-transform: uppercase;
  }

  /* Nav button */
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
    bottom: 2px; left: 50%;
    width: 0; height: 2px;
    border-radius: 1px;
    transition: all 0.3s var(--transition-smooth);
    transform: translateX(-50%);
  }

  .nav-btn:hover::after { width: 70%; }

  .nav-btn-logout::after { background: var(--cinnabar); }

  .nav-btn-logout:hover {
    background: rgba(179, 58, 58, 0.06);
  }

  .nav-btn:hover .crisp-icon.nav-icon-size { opacity: 1; }

  .nav-btn-logout:hover .crisp-icon.nav-icon-size {
    filter: brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(89%) contrast(97%);
    opacity: 1;
  }

  .nav-btn-label {
    font-family: var(--font-main);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--ink);
    opacity: 0.45;
    letter-spacing: 0.04em;
    transition: all 0.25s;
  }

  .nav-btn:hover .nav-btn-label { opacity: 0.8; }

  .nav-btn-logout:hover .nav-btn-label {
    color: var(--cinnabar);
    opacity: 0.8;
  }

  /* ═══════════════════════════════════════
     MAIN CONTENT
  ═══════════════════════════════════════ */
  .profile-content {
    max-width: 700px; margin: 0 auto; position: relative; z-index: 1;
    opacity: 0; transform: translateY(20px);
    transition: all 0.6s var(--transition-smooth);
  }
  .profile-content.loaded { opacity: 1; transform: translateY(0); }

  /* Profile Header */
  .profile-header {
    display: flex; flex-direction: column; align-items: center;
    margin-bottom: 2rem; padding: 2rem 0;
  }

  .profile-avatar {
    position: relative; width: 100px; height: 100px; margin-bottom: 1.25rem;
  }

  .avatar-inner {
    width: 100%; height: 100%;
    background: var(--parchment-light); border: 3px solid var(--ink);
    border-radius: 50%; display: flex; align-items: center;
    justify-content: center; transition: all 0.3s; color: var(--ink-muted);
  }

  .avatar-badge {
    position: absolute; bottom: 0; right: 0;
    width: 32px; height: 32px; background: var(--cinnabar);
    border: 2px solid var(--parchment); border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: var(--parchment);
  }

  .profile-info { text-align: center; }
  .profile-name { font-size: 1.5rem; font-weight: 800; color: var(--ink); margin-bottom: 0.25rem; }
  .profile-email { font-size: 0.85rem; color: var(--ink-muted); }

  /* ═══════════════════════════════════════
     MANGA PANEL
  ═══════════════════════════════════════ */
  .manga-panel {
    background: var(--parchment-light);
    border: var(--border-thick) solid var(--ink);
    border-radius: var(--radius-sm);
    padding: 2rem; position: relative;
    transition: all 0.3s var(--transition-smooth);
  }
  .manga-panel::before {
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

  .panel-header {
    display: flex; align-items: center; gap: 1rem;
    margin-bottom: 1.75rem; padding-bottom: 0.85rem; border-bottom: 2px solid var(--ink);
  }
  .panel-number {
    font-size: 0.65rem; font-weight: 800; color: var(--parchment);
    background: var(--ink); padding: 0.3rem 0.6rem; letter-spacing: 0.05em;
    border-radius: 2px;
  }
  .pw-badge { background: var(--cinnabar); }
  .panel-header h2 {
    font-size: 0.82rem; font-weight: 700; color: var(--ink);
    letter-spacing: 0.1em; text-transform: uppercase; margin: 0;
  }

  /* ═══════════════════════════════════════
     FORM
  ═══════════════════════════════════════ */
  .form-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem; margin-bottom: 1.5rem;
  }
  @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }

  .input-group { display: flex; flex-direction: column; gap: 0.65rem; }
  .input-group.full-width { margin-bottom: 1.5rem; }

  .input-label { display: flex; align-items: center; gap: 0.75rem; }
  .label-text {
    font-size: 0.68rem; font-weight: 700; color: var(--ink);
    letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap;
  }
  .label-line {
    flex: 1; height: 1px;
    background: linear-gradient(90deg, var(--ink-muted) 0%, transparent 100%); opacity: 0.2;
  }

  .input-field {
    display: flex; align-items: stretch;
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    background: var(--parchment-light);
    transition: all 0.25s var(--transition-smooth);
    overflow: hidden;
  }
  .input-field:focus-within {
    border-color: var(--indigo);
    box-shadow: 0 0 0 3px rgba(38, 70, 83, 0.1);
  }

  /* ═══ INPUT ICON BOX — distinct from typing area ═══ */
  .input-icon-box {
    display: flex; align-items: center; justify-content: center;
    width: 44px; min-width: 44px;
    background: var(--parchment-dark);
    border-right: 1.5px solid rgba(26, 26, 46, 0.12);
    transition: all 0.25s var(--transition-smooth);
  }

  .input-field:focus-within .input-icon-box {
    background: rgba(38, 70, 83, 0.08);
    border-right-color: rgba(38, 70, 83, 0.15);
  }

  .input-field:focus-within .crisp-icon.field-icon {
    opacity: 0.85;
    filter: brightness(0) saturate(100%) invert(20%) sepia(15%) saturate(1500%) hue-rotate(155deg) brightness(85%) contrast(100%);
  }

  .neo-input {
    flex: 1; width: 100%; padding: 0.85rem 1rem;
    background: var(--parchment); border: none;
    font-family: var(--font-main); font-size: 0.88rem; color: var(--ink); outline: none;
  }
  .neo-input::placeholder { color: var(--ink-muted); opacity: 0.45; font-style: italic; }

  .neo-textarea {
    width: 100%; padding: 1rem; background: var(--parchment);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    font-family: var(--font-main);
    font-size: 0.88rem; color: var(--ink); line-height: 1.6;
    resize: vertical; outline: none; transition: all 0.25s;
  }
  .neo-textarea:focus { border-color: var(--indigo); box-shadow: 0 0 0 3px rgba(38, 70, 83, 0.1); }
  .neo-textarea::placeholder { color: var(--ink-muted); opacity: 0.45; font-style: italic; }

  /* ═══════════════════════════════════════
     MESSAGE BOX
  ═══════════════════════════════════════ */
  .message-box {
    display: flex; align-items: flex-start; gap: 0.75rem;
    padding: 0.85rem 1rem; border: 2px solid;
    border-radius: var(--radius-sm);
    font-size: 0.8rem; font-weight: 500; line-height: 1.4;
    margin-bottom: 1.5rem; animation: messageAppear 0.3s var(--transition-snap);
  }
  @keyframes messageAppear {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .message-box.error { background: rgba(179, 58, 58, 0.08); border-color: var(--cinnabar); color: var(--cinnabar-dark); }
  .message-box.success { background: rgba(42, 157, 143, 0.08); border-color: var(--indigo-light); color: var(--indigo); }

  /* ═══════════════════════════════════════
     ACTION BUTTONS
  ═══════════════════════════════════════ */
  .form-actions { display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap; }

  .action-btn {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.85rem 1.25rem; font-family: var(--font-main);
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.25s var(--transition-smooth);
    position: relative;
    overflow: hidden;
  }

  .action-btn::after {
    content: ''; position: absolute; bottom: 0; left: 0;
    width: 100%; height: 3px;
    transform: scaleX(0); transform-origin: right;
    transition: transform 0.3s var(--transition-smooth);
  }

  .action-btn:hover::after { transform: scaleX(1); transform-origin: left; }

  .action-btn.secondary {
    background: transparent; color: var(--ink);
  }
  .action-btn.secondary::after { background: var(--cinnabar); }
  .action-btn.secondary:hover {
    background: var(--parchment-dark);
    transform: translateY(-2px);
    box-shadow: 0 3px 0 rgba(26, 26, 46, 0.15);
  }
  .action-btn.secondary:active { transform: translateY(0); box-shadow: none; }
  .action-btn.secondary:hover .crisp-icon.action-icon-dark { opacity: 1; }

  .action-btn.primary {
    background: var(--ink); color: var(--parchment);
  }
  .action-btn.primary::after { background: var(--sunflower); }
  .action-btn.primary:hover:not(:disabled) {
    background: var(--ink-light);
    transform: translateY(-2px);
    box-shadow: 0 4px 0 var(--ink);
  }
  .action-btn.primary:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
  .action-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .action-btn.primary:hover .crisp-icon.inverted { opacity: 1; }

  .btn-loader {
    width: 16px; height: 16px;
    border: 2px solid var(--parchment); border-top-color: transparent;
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }

  /* ═══════════════════════════════════════
     MODAL
  ═══════════════════════════════════════ */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(26, 26, 46, 0.6);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex; align-items: center;
    justify-content: center; z-index: 1000; padding: 1rem; animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .modal-container {
    width: 100%; max-width: 450px; animation: slideUp 0.4s var(--transition-snap);
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

  .modal-close-btn {
    position: absolute; top: 1rem; right: 1rem;
    width: 38px; height: 38px; background: var(--parchment);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s var(--transition-snap); color: var(--ink); z-index: 10;
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
  .modal-header h2 {
    font-size: 1rem; font-weight: 700; color: var(--ink);
    letter-spacing: 0.05em; margin: 0;
  }

  .modal-body { display: flex; flex-direction: column; gap: 1.25rem; }
  .modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 0.5rem; }

  .modal-btn {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.75rem 1.25rem; font-family: var(--font-main);
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    cursor: pointer; transition: all 0.25s;
  }
  .modal-btn.secondary { background: transparent; color: var(--ink); }
  .modal-btn.secondary:hover { background: var(--parchment-dark); transform: translateY(-1px); }
  .modal-btn.secondary:active { transform: translateY(0); }
  .modal-btn.primary { background: var(--cinnabar); border-color: var(--cinnabar); color: var(--parchment); }
  .modal-btn.primary:hover:not(:disabled) {
    background: var(--cinnabar-dark); border-color: var(--cinnabar-dark);
    transform: translateY(-2px); box-shadow: 0 3px 0 var(--cinnabar-dark);
  }
  .modal-btn.primary:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
  .modal-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ═══════════════════════════════════════
     NEW CUSTOMIZATION STYLES
  ═══════════════════════════════════════ */
  .customization-panel {
    margin-top: 2rem;
    border-color: var(--indigo);
  }

  .customization-panel .panel-corners .corner {
    border-color: var(--indigo-light);
  }

  .neo-select {
    width: 100%;
    background: var(--parchment-light);
    border: var(--border-thin) solid var(--ink);
    padding: 0.75rem 1rem;
    font-family: var(--font-main);
    font-size: 0.95rem;
    color: var(--ink);
    cursor: pointer;
    transition: all 0.2s var(--transition-smooth);
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 1.2rem;
  }

  .neo-select:focus {
    outline: none;
    border-color: var(--indigo);
    box-shadow: 0 0 0 3px rgba(38, 70, 83, 0.1);
    transform: translateY(-1px);
  }

  .checkbox-group {
    grid-column: 1 / -1;
    margin-top: 0.5rem;
  }

  .checkbox-container {
    display: flex;
    align-items: center;
    position: relative;
    padding-left: 35px;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--ink-muted);
    user-select: none;
    transition: color 0.2s;
  }

  .checkbox-container:hover {
    color: var(--ink);
  }

  .checkbox-container input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .checkmark {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    height: 20px;
    width: 20px;
    background: var(--parchment-light);
    border: var(--border-thin) solid var(--ink);
    transition: all 0.2s var(--transition-snap);
  }

  .checkbox-container:hover input ~ .checkmark {
    background-color: var(--parchment-dark);
  }

  .checkbox-container input:checked ~ .checkmark {
    background-color: var(--indigo);
    border-color: var(--indigo);
  }

  .checkmark:after {
    content: "";
    position: absolute;
    display: none;
  }

  .checkbox-container input:checked ~ .checkmark:after {
    display: block;
  }

  .checkbox-container .checkmark:after {
    left: 6px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid var(--parchment);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .checkbox-label {
    line-height: 1.2;
  }

  /* ═══════════════════════════════════════
     FOOTER
  ═══════════════════════════════════════ */
  .profile-footer { margin-top: 3rem; text-align: center; }
  .footer-line {
    display: flex; align-items: center; justify-content: center;
    gap: 1.25rem; margin-bottom: 0.85rem;
  }
  .footer-line .line {
    width: 50px; height: 2px;
    background: linear-gradient(90deg, transparent, var(--ink-muted), transparent); opacity: 0.25;
  }
  .footer-emblem { color: var(--cinnabar); opacity: 0.4; }
  .footer-text {
    font-size: 0.62rem; color: var(--ink-muted);
    letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.4;
  }

  /* ═══════════════════════════════════════
     RESPONSIVE
  ═══════════════════════════════════════ */
  @media (max-width: 600px) {
    .profile-container { padding: 1rem; padding-top: 4.5rem; }
    .top-nav { padding: 0 1rem; height: 50px; }
    .nav-back-btn span { display: none; }
    .nav-page-label { display: none; }
    .nav-sep { display: none; }
    .nav-btn { padding: 0.35rem 0.5rem; }
    .nav-btn-label { display: none; }

    .crisp-icon { width: 18px !important; height: 18px !important; }
    .crisp-icon.nav-icon-size { width: 20px !important; height: 20px !important; }
    .crisp-icon.field-icon { width: 16px !important; height: 16px !important; }
    .crisp-icon.avatar-icon { width: 40px !important; height: 40px !important; }
    .crisp-icon.badge-sm-icon { width: 14px !important; height: 14px !important; }

    .manga-panel { padding: 1.5rem; }
    .form-actions { flex-direction: column; }
    .action-btn { width: 100%; justify-content: center; }
    .modal-panel { padding: 1.5rem; }
    .modal-actions { flex-direction: column; }
    .modal-btn { width: 100%; justify-content: center; }
    .input-icon-box { width: 38px; min-width: 38px; }
  }

  /* ═══════════════════════════════════════
     UTILITIES
  ═══════════════════════════════════════ */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: var(--parchment-dark); }
  ::-webkit-scrollbar-thumb { background: var(--ink-muted); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--ink); }
  ::selection { background: var(--sunflower); color: var(--ink); }
`;

export default ProfileScreen;