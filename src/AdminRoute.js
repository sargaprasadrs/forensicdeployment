// src/AdminRoute.js
import { Navigate } from "react-router-dom";
import { auth, db } from "./firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

export default function AdminRoute({ children }) {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAllowed(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        setAllowed(snap.exists() && snap.data()?.active === true);
      } catch (err) {
        console.error("Admin check failed:", err);
        setAllowed(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (allowed === null) return null;
  return allowed ? children : <Navigate to="/" replace />;
}