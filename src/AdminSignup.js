import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "./firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AdminSignup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleAdminSignup = async () => {
    if (!email || !password) {
      setError("Email and password required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // 1️⃣ Create Auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // 2️⃣ Create USER document
      await setDoc(doc(db, "users", uid), {
        email: cred.user.email,
        role: "user",
        active: true,
        createdAt: serverTimestamp(),
      });

      console.log("✅ User document created");

      // 3️⃣ Create ADMIN document (FORCE)
      await setDoc(
        doc(db, "admins", uid),
        {
          email: cred.user.email,
          role: "admin",
          active: true,
          createdAt: serverTimestamp(),
        },
        { merge: true } // 🔒 important safety
      );

      console.log("✅ Admin document created");

      setSuccess("Admin account created successfully");

      setTimeout(() => navigate("/admin"), 1200);

    } catch (err) {
      console.error("ADMIN SIGNUP ERROR:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "auto" }}>
      <h2>Admin Signup (One-Time)</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      <input
        type="email"
        placeholder="Admin Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", marginBottom: "1rem" }}
      />

      <input
        type="password"
        placeholder="Admin Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", marginBottom: "1rem" }}
      />

      <button onClick={handleAdminSignup} disabled={loading}>
        {loading ? "Creating..." : "Create Admin"}
      </button>
    </div>
  );
}
