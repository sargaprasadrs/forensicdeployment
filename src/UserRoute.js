// src/UserRoute.js
import { Navigate } from "react-router-dom";
import { auth, db } from "./firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

export default function UserRoute({ children }) {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAllowed(false);
        return;
      }

      try {
        // Only check if user exists in users collection
        // This allows admins who also have user accounts to access user routes
        const userSnap = await getDoc(doc(db, "users", user.uid));
        setAllowed(userSnap.exists() && userSnap.data()?.active === true);
      } catch (err) {
        console.error("User route check failed:", err);
        setAllowed(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (allowed === null) return null;
  return allowed ? children : <Navigate to="/login" replace />;
}