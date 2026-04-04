// src/AdminUserAnalytics.js
import React, { useEffect, useState } from "react";
import { db } from "./firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { auth } from "./firebaseConfig";
import { useNavigate } from "react-router-dom";
import { query, where } from "firebase/firestore";

export default function AdminUserAnalytics() {
  const navigate = useNavigate();
  const [userActivity, setUserActivity] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFeedback, setUserFeedback] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    fetchAuditData();
  }, []);

  const fetchUserActivity = async (uid) => {
    try {
      const q = query(
        collection(db, "user_activity"),
        where("uid", "==", uid)
      );

      const snap = await getDocs(q);

      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      setUserActivity(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load user activity.");
    }
  };

  const fetchUserFeedback = async (uid) => {
    try {
      const q = query(
        collection(db, "feedback"),
        where("userId", "==", uid)
      );

      const snap = await getDocs(q);

      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      setUserFeedback(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load user feedback.");
    }
  };

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      
      const usersSnap = await getDocs(collection(db, "users"));
      const usersData = usersSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        role: "user",
      }));

      const adminsSnap = await getDocs(collection(db, "admins"));
      const adminsData = adminsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        role: "admin",
      }));

      setUsers(usersData);
      setAdmins(adminsData);
    } catch (err) {
      console.error(err);
      setError("Failed to load audit data.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAccountStatus = async (collectionName, uid, currentStatus) => {
    try {
      await updateDoc(doc(db, collectionName, uid), {
        active: !currentStatus,
      });

      await addDoc(collection(db, "audit_logs"), {
        adminUid: auth.currentUser?.uid || "unknown",
        targetUid: uid,
        action: currentStatus ? "DISABLE_USER" : "ENABLE_USER",
        timestamp: serverTimestamp(),
      });

      fetchAuditData();
    } catch (err) {
      console.error(err);
      setError("Failed to update account status.");
    }
  };

  const handleUserSelect = (acc) => {
    setSelectedUser(acc);
    setUserActivity([]);
    setUserFeedback([]);
    fetchUserFeedback(acc.id);
    fetchUserActivity(acc.id);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setUserActivity([]);
    setUserFeedback([]);
  };

  const totalUsers = users.length;
  const totalAdmins = admins.length;
  const activeUsers = users.filter(u => u.active).length;
  const inactiveUsers = totalUsers - activeUsers;

  return (
    <div className="audit-container">
      {/* Paper Texture */}
      <div className="paper-texture" />

      {/* Decorative Elements */}
      <svg className="ink-splatter top-left" viewBox="0 0 100 100">
        <circle cx="15" cy="15" r="20" fill="var(--admin-primary)" opacity="0.08" />
        <circle cx="35" cy="25" r="10" fill="var(--admin-primary)" opacity="0.06" />
      </svg>

      <svg className="ink-splatter bottom-right" viewBox="0 0 100 100">
        <circle cx="80" cy="85" r="18" fill="var(--indigo)" opacity="0.07" />
        <circle cx="65" cy="75" r="8" fill="var(--indigo)" opacity="0.05" />
      </svg>

      {/* Main Content */}
      <main className={`audit-content ${isLoaded ? 'loaded' : ''}`}>
        
        {/* Header */}
        <header className="audit-header">
          <div className="header-left">
            <div className="hanko-stamp">
              <span>UA</span>
            </div>
            <div className="header-titles">
              <span className="header-accent">Administration</span>
              <h1 className="header-main">User Analytics</h1>
            </div>
          </div>
          
          <button className="back-button" onClick={() => navigate("/admin")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Back to Admin</span>
          </button>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="loader" />
            <span>Loading audit data...</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon users">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{totalUsers}</span>
                  <span className="stat-label">Total Users</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon active">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{activeUsers}</span>
                  <span className="stat-label">Active Users</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon inactive">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{inactiveUsers}</span>
                  <span className="stat-label">Inactive</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon admins">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{totalAdmins}</span>
                  <span className="stat-label">Admins</span>
                </div>
              </div>
            </div>

            {/* Accounts Table */}
            <section className="table-section">
              <div className="section-header">
                <span className="section-number">01</span>
                <h2>All Accounts</h2>
              </div>

              <div className="table-wrapper">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...admins, ...users].map(acc => (
                      <tr
                        key={acc.id}
                        onClick={() => handleUserSelect(acc)}
                        className="table-row"
                      >
                        <td className="email-cell">{acc.email}</td>
                        <td>
                          <span className={`role-badge ${acc.role}`}>
                            {acc.role}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${acc.active ? 'active' : 'inactive'}`}>
                            {acc.active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="date-cell">
                          {acc.createdAt?.toDate
                            ? acc.createdAt.toDate().toLocaleDateString()
                            : "—"}
                        </td>
                        <td>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAccountStatus(
                                acc.role === "admin" ? "admins" : "users",
                                acc.id,
                                acc.active
                              );
                            }}
                            className={`action-btn ${acc.active ? 'disable' : 'enable'}`}
                          >
                            {acc.active ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="user-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Corners */}
            <div className="modal-corners">
              <div className="corner top-left" />
              <div className="corner top-right" />
              <div className="corner bottom-left" />
              <div className="corner bottom-right" />
            </div>

            {/* Modal Header - Fixed */}
            <div className="modal-header">
              <span className="modal-number">UD</span>
              <h3>User Details</h3>
              <button className="close-btn" onClick={closeModal}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="modal-body">
              {/* User Info Section */}
              <div className="user-info-section">
                <div className="user-avatar">
                  <span>{selectedUser.email?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="user-primary-info">
                  <span className="user-email">{selectedUser.email}</span>
                  <div className="user-badges">
                    <span className={`role-badge ${selectedUser.role}`}>
                      {selectedUser.role}
                    </span>
                    <span className={`status-badge ${selectedUser.active ? 'active' : 'inactive'}`}>
                      {selectedUser.active ? "Active" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Created</span>
                  <span className="detail-value">
                    {selectedUser.createdAt?.toDate
                      ? selectedUser.createdAt.toDate().toLocaleString()
                      : "—"}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Last Login</span>
                  <span className="detail-value">
                    {selectedUser.lastLoginAt?.toDate
                      ? selectedUser.lastLoginAt.toDate().toLocaleString()
                      : "Never"}
                  </span>
                </div>
              </div>

              {/* Activity Section */}
              <div className="scrollable-section">
                <div className="section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  <span>User Activity</span>
                  <span className="count-badge">{userActivity.length}</span>
                </div>
                
                <div className="scrollable-content">
                  {userActivity.length === 0 ? (
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                      </svg>
                      <span>No activity recorded</span>
                    </div>
                  ) : (
                    userActivity
                      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                      .map(act => (
                        <div key={act.id} className="activity-item">
                          <div className="activity-dot" />
                          <div className="activity-content">
                            <span className="activity-type">{act.type}</span>
                            <span className="activity-action">{act.action}</span>
                            <span className="activity-time">
                              {act.timestamp?.toDate
                                ? act.timestamp.toDate().toLocaleString()
                                : ""}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Feedback Section */}
              <div className="scrollable-section">
                <div className="section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>User Feedback</span>
                  <span className="count-badge">{userFeedback.length}</span>
                </div>
                
                <div className="scrollable-content">
                  {userFeedback.length === 0 ? (
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span>No feedback submitted</span>
                    </div>
                  ) : (
                    userFeedback.map((f) => (
                      <div key={f.id} className="feedback-item">
                        <p className="feedback-text">{f.text || f.message}</p>
                        <span className="feedback-time">
                          {f.createdAt?.toDate
                            ? f.createdAt.toDate().toLocaleString()
                            : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer - Fixed */}
            <div className="modal-footer">
              <button 
                className={`modal-action-btn ${selectedUser.active ? 'disable' : 'enable'}`}
                onClick={() => {
                  toggleAccountStatus(
                    selectedUser.role === "admin" ? "admins" : "users",
                    selectedUser.id,
                    selectedUser.active
                  );
                  closeModal();
                }}
              >
                {selectedUser.active ? "Disable Account" : "Enable Account"}
              </button>
              <button className="modal-close-btn" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ═══════════════════════════════════════
           ADMIN USER ANALYTICS - NEO-EDO THEME
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
          --indigo: #264653;
          --indigo-light: #2A9D8F;
          --sunflower: #E9C46A;
          --gold: #D4A84B;
          --admin-primary: #6B21A8;
          --admin-light: #A855F7;
          --admin-dark: #581C87;
          --success: #2A9D8F;
          --danger: #B33A3A;

          --font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --border-thick: 3px;
          --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
          --transition-snap: cubic-bezier(0.68, -0.55, 0.265, 1.55);
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

        .audit-container {
          min-height: 100vh;
          background: var(--parchment);
          position: relative;
          font-family: var(--font-main);
          overflow-x: hidden;
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
          width: 150px;
          height: 150px;
          pointer-events: none;
          z-index: 0;
        }

        .ink-splatter.top-left { top: 0; left: 0; }
        .ink-splatter.bottom-right { bottom: 0; right: 0; }

        /* ═══════════════════════════════════════
           MAIN CONTENT
        ═══════════════════════════════════════ */

        .audit-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.5rem 2rem;
          position: relative;
          z-index: 1;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.6s var(--transition-smooth);
        }

        .audit-content.loaded {
          opacity: 1;
          transform: translateY(0);
        }

        /* ═══════════════════════════════════════
           HEADER
        ═══════════════════════════════════════ */

        .audit-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 3px solid var(--ink);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .hanko-stamp {
          width: 50px;
          height: 50px;
          background: var(--admin-primary);
          border: 3px solid var(--admin-dark);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(-5deg);
          box-shadow: 2px 2px 0 var(--admin-dark);
        }

        .hanko-stamp span {
          font-size: 1rem;
          font-weight: 900;
          color: white;
          letter-spacing: 0.05em;
        }

        .header-titles {
          display: flex;
          flex-direction: column;
        }

        .header-accent {
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--admin-primary);
          letter-spacing: 0.3em;
          text-transform: uppercase;
        }

        .header-main {
          font-size: 1.5rem;
          font-weight: 900;
          color: var(--ink);
          letter-spacing: 0.05em;
          margin: 0;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1rem;
          background: var(--parchment);
          border: 2px solid var(--ink);
          color: var(--ink);
          font-family: var(--font-main);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.25s var(--transition-smooth);
        }

        .back-button svg {
          width: 16px;
          height: 16px;
        }

        .back-button:hover {
          background: var(--ink);
          color: var(--parchment);
          transform: translateX(-3px);
        }

        /* ═══════════════════════════════════════
           LOADING & ERROR STATES
        ═══════════════════════════════════════ */

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 4rem;
          color: var(--ink-muted);
        }

        .loader {
          width: 40px;
          height: 40px;
          border: 3px solid var(--admin-primary);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(179, 58, 58, 0.08);
          border: 2px solid var(--cinnabar);
          color: var(--cinnabar-dark);
          margin-bottom: 1.5rem;
        }

        .error-box svg {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        /* ═══════════════════════════════════════
           STATS GRID
        ═══════════════════════════════════════ */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: var(--parchment-light);
          border: 2px solid var(--ink);
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.25s var(--transition-smooth);
        }

        .stat-card:hover {
          transform: translate(-2px, -2px);
          box-shadow: var(--shadow-hard);
        }

        .stat-icon {
          width: 45px;
          height: 45px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon svg {
          width: 22px;
          height: 22px;
        }

        .stat-icon.users {
          background: rgba(38, 70, 83, 0.1);
          color: var(--indigo);
        }

        .stat-icon.active {
          background: rgba(42, 157, 143, 0.1);
          color: var(--success);
        }

        .stat-icon.inactive {
          background: rgba(179, 58, 58, 0.1);
          color: var(--danger);
        }

        .stat-icon.admins {
          background: rgba(107, 33, 168, 0.1);
          color: var(--admin-primary);
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 900;
          color: var(--ink);
          line-height: 1;
        }

        .stat-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--ink-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-top: 0.25rem;
        }

        /* ═══════════════════════════════════════
           TABLE SECTION
        ═══════════════════════════════════════ */

        .table-section {
          background: var(--parchment-light);
          border: var(--border-thick) solid var(--ink);
          position: relative;
        }

        .table-section::before {
          content: '';
          position: absolute;
          inset: 5px;
          border: 1.5px solid var(--ink);
          pointer-events: none;
          opacity: 0.1;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          border-bottom: 2px solid var(--ink);
        }

        .section-number {
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--parchment);
          background: var(--ink);
          padding: 0.25rem 0.5rem;
          letter-spacing: 0.05em;
        }

        .section-header h2 {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
        }

        .audit-table th,
        .audit-table td {
          padding: 0.85rem 1rem;
          text-align: left;
          font-size: 0.8rem;
        }

        .audit-table th {
          background: var(--ink);
          color: var(--parchment);
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: 0.7rem;
        }

        .audit-table tbody tr {
          border-bottom: 1px solid var(--parchment-dark);
          cursor: pointer;
          transition: background 0.2s;
        }

        .audit-table tbody tr:hover {
          background: rgba(107, 33, 168, 0.05);
        }

        .email-cell {
          font-weight: 600;
          color: var(--ink);
        }

        .date-cell {
          color: var(--ink-muted);
          font-size: 0.75rem;
        }

        .role-badge {
          display: inline-block;
          padding: 0.25rem 0.6rem;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-radius: 2px;
        }

        .role-badge.admin {
          background: rgba(107, 33, 168, 0.15);
          color: var(--admin-primary);
        }

        .role-badge.user {
          background: rgba(38, 70, 83, 0.15);
          color: var(--indigo);
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.6rem;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-radius: 2px;
        }

        .status-badge.active {
          background: rgba(42, 157, 143, 0.15);
          color: var(--success);
        }

        .status-badge.inactive {
          background: rgba(179, 58, 58, 0.15);
          color: var(--danger);
        }

        .action-btn {
          padding: 0.4rem 0.8rem;
          font-family: var(--font-main);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn.enable {
          background: var(--success);
          color: white;
        }

        .action-btn.disable {
          background: var(--danger);
          color: white;
        }

        .action-btn:hover {
          transform: scale(1.05);
        }

        /* ═══════════════════════════════════════
           USER MODAL
        ═══════════════════════════════════════ */

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26, 26, 46, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .user-modal {
          background: var(--parchment-light);
          border: var(--border-thick) solid var(--admin-primary);
          width: 100%;
          max-width: 480px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          position: relative;
          animation: slideUp 0.3s var(--transition-snap);
        }

        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }

        .user-modal::before {
          content: '';
          position: absolute;
          inset: 5px;
          border: 1.5px solid var(--admin-primary);
          pointer-events: none;
          opacity: 0.15;
        }

        .modal-corners .corner {
          position: absolute;
          width: 14px;
          height: 14px;
          border-color: var(--admin-light);
          border-style: solid;
          opacity: 0.7;
          z-index: 1;
        }

        .modal-corners .corner.top-left { top: -1px; left: -1px; border-width: 3px 0 0 3px; }
        .modal-corners .corner.top-right { top: -1px; right: -1px; border-width: 3px 3px 0 0; }
        .modal-corners .corner.bottom-left { bottom: -1px; left: -1px; border-width: 0 0 3px 3px; }
        .modal-corners .corner.bottom-right { bottom: -1px; right: -1px; border-width: 0 3px 3px 0; }

        /* Modal Header - Fixed */
        .modal-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          border-bottom: 2px solid var(--ink);
          flex-shrink: 0;
          background: var(--parchment-light);
        }

        .modal-number {
          font-size: 0.65rem;
          font-weight: 800;
          color: white;
          background: var(--admin-primary);
          padding: 0.25rem 0.5rem;
          letter-spacing: 0.05em;
        }

        .modal-header h3 {
          flex: 1;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0;
        }

        .close-btn {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 2px solid var(--ink-muted);
          color: var(--ink-muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-btn svg {
          width: 14px;
          height: 14px;
        }

        .close-btn:hover {
          background: var(--cinnabar);
          border-color: var(--cinnabar);
          color: white;
        }

        /* Modal Body - Scrollable */
        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* User Info Section */
        .user-info-section {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--parchment-dark);
        }

        .user-avatar {
          width: 50px;
          height: 50px;
          background: var(--admin-primary);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .user-avatar span {
          font-size: 1.25rem;
          font-weight: 900;
          color: white;
        }

        .user-primary-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .user-email {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--ink);
          word-break: break-all;
        }

        .user-badges {
          display: flex;
          gap: 0.5rem;
        }

        /* Details Grid */
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .detail-item {
          background: var(--parchment);
          border: 1px solid var(--parchment-dark);
          padding: 0.75rem;
        }

        .detail-label {
          display: block;
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--ink-muted);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }

        .detail-value {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--ink);
        }

        /* Scrollable Sections */
        .scrollable-section {
          display: flex;
          flex-direction: column;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--parchment-dark);
          margin-bottom: 0.75rem;
        }

        .section-title svg {
          width: 16px;
          height: 16px;
          color: var(--admin-primary);
        }

        .section-title span {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .count-badge {
          background: var(--admin-primary);
          color: white;
          padding: 0.15rem 0.4rem;
          font-size: 0.6rem;
          font-weight: 700;
          border-radius: 2px;
          margin-left: auto;
        }

        .scrollable-content {
          max-height: 120px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1.5rem;
          color: var(--ink-muted);
          text-align: center;
        }

        .empty-state svg {
          width: 24px;
          height: 24px;
          opacity: 0.5;
        }

        .empty-state span {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        /* Activity Item */
        .activity-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.6rem;
          background: var(--parchment);
          border-left: 3px solid var(--indigo);
        }

        .activity-dot {
          width: 8px;
          height: 8px;
          background: var(--indigo);
          border-radius: 50%;
          margin-top: 0.25rem;
          flex-shrink: 0;
        }

        .activity-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .activity-type {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--ink);
        }

        .activity-action {
          font-size: 0.7rem;
          color: var(--ink-muted);
        }

        .activity-time {
          font-size: 0.6rem;
          color: var(--ink-muted);
          opacity: 0.7;
        }

        /* Feedback Item */
        .feedback-item {
          padding: 0.75rem;
          background: var(--parchment);
          border-left: 3px solid var(--success);
        }

        .feedback-text {
          font-size: 0.8rem;
          color: var(--ink);
          line-height: 1.5;
          margin: 0 0 0.5rem 0;
        }

        .feedback-time {
          font-size: 0.6rem;
          color: var(--ink-muted);
          opacity: 0.7;
        }

        /* Modal Footer - Fixed */
        .modal-footer {
          display: flex;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          border-top: 2px solid var(--ink);
          background: var(--parchment-light);
          flex-shrink: 0;
        }

        .modal-action-btn {
          flex: 1;
          padding: 0.7rem 1rem;
          font-family: var(--font-main);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-action-btn.enable {
          background: var(--success);
          color: white;
        }

        .modal-action-btn.disable {
          background: var(--danger);
          color: white;
        }

        .modal-action-btn:hover {
          transform: translateY(-2px);
        }

        .modal-close-btn {
          padding: 0.7rem 1.5rem;
          background: var(--ink);
          color: var(--parchment);
          border: none;
          font-family: var(--font-main);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-close-btn:hover {
          background: var(--ink-light);
          transform: translateY(-2px);
        }

        /* ═══════════════════════════════════════
           SCROLLBAR STYLING
        ═══════════════════════════════════════ */

        .modal-body::-webkit-scrollbar,
        .scrollable-content::-webkit-scrollbar {
          width: 6px;
        }

        .modal-body::-webkit-scrollbar-track,
        .scrollable-content::-webkit-scrollbar-track {
          background: var(--parchment-dark);
        }

        .modal-body::-webkit-scrollbar-thumb,
        .scrollable-content::-webkit-scrollbar-thumb {
          background: var(--admin-light);
          border-radius: 3px;
        }

        .modal-body::-webkit-scrollbar-thumb:hover,
        .scrollable-content::-webkit-scrollbar-thumb:hover {
          background: var(--admin-primary);
        }

        /* ═══════════════════════════════════════
           RESPONSIVE
        ═══════════════════════════════════════ */

        @media (max-width: 768px) {
          .audit-content {
            padding: 1rem;
          }

          .audit-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .hanko-stamp {
            width: 40px;
            height: 40px;
          }

          .header-main {
            font-size: 1.25rem;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .stat-card {
            padding: 1rem;
          }

          .stat-value {
            font-size: 1.5rem;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .user-modal {
            max-height: 90vh;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .audit-table th,
          .audit-table td {
            padding: 0.6rem 0.5rem;
            font-size: 0.7rem;
          }

          .modal-footer {
            flex-direction: column;
          }

          .modal-action-btn,
          .modal-close-btn {
            width: 100%;
          }
        }

        /* ═══════════════════════════════════════
           SELECTION
        ═══════════════════════════════════════ */

        ::selection {
          background: var(--admin-light);
          color: white;
        }
      `}</style>
    </div>
  );
}