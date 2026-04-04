// ═══════════════════════════════════════════════════════════════════════════════
// ██╗    ██╗██╗████████╗███╗   ██╗███████╗███████╗███████╗
// ██║    ██║██║╚══██╔══╝████╗  ██║██╔════╝██╔════╝██╔════╝
// ██║ █╗ ██║██║   ██║   ██╔██╗ ██║█████╗  ███████╗███████╗
// ██║███╗██║██║   ██║   ██║╚██╗██║██╔══╝  ╚════██║╚════██║
// ╚███╔███╔╝██║   ██║   ██║ ╚████║███████╗███████║███████║
//  ╚══╝╚══╝ ╚═╝   ╚═╝   ╚═╝  ╚═══╝╚══════╝╚══════╝╚══════╝
//                    SKETCH SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
//
//  Firebase Configuration Module
//  ─────────────────────────────
//  "The path of the warrior is lifelong, and mastery is often simply
//   staying on the path." - This config establishes our connection.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SYSTEM CONSTANTS                                                           │
// └─────────────────────────────────────────────────────────────────────────────┘

const SYSTEM_NAME = "WITNESS SKETCH";
const VERSION = "1.0.0";

// Neo-Edo console styling
const consoleStyles = {
  header: `
    background: linear-gradient(90deg, #1a1a2e 0%, #264653 100%);
    color: #F5F0E1;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: bold;
    font-family: 'Courier New', monospace;
    border-left: 4px solid #B33A3A;
  `,
  success: `
    background: #264653;
    color: #E9C46A;
    padding: 8px 16px;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    border-left: 3px solid #2A9D8F;
  `,
  error: `
    background: #1a1a2e;
    color: #D64545;
    padding: 8px 16px;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    border-left: 3px solid #B33A3A;
  `,
  info: `
    background: transparent;
    color: #4a4a5e;
    padding: 4px 8px;
    font-size: 11px;
    font-family: 'Courier New', monospace;
  `,
  stamp: `
    background: #B33A3A;
    color: #F5F0E1;
    padding: 4px 12px;
    font-size: 10px;
    font-weight: bold;
    font-family: 'Courier New', monospace;
    border-radius: 2px;
  `
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  FIREBASE CREDENTIALS                                                       │
// │  ───────────────────                                                        │
// │  These keys connect our system to the cloud.                                │
// │  Handle with the care of a blade.                                           │
// └─────────────────────────────────────────────────────────────────────────────┘

const firebaseConfig = {
  apiKey: "AIzaSyDqEjWpu-V_jxM-SWofoc8Mj9-FXkTWTs4",
  authDomain: "forensic-sketch.firebaseapp.com",
  projectId: "forensic-sketch",
  storageBucket: "forensic-sketch.firebasestorage.app",
  messagingSenderId: "644667407607",
  appId: "1:644667407607:web:e90dffe11038c04b1027f2",
  measurementId: "G-LB821R5BVG",
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  INITIALIZATION SEQUENCE                                                    │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Logs a stylized message to the console
 * @param {string} type - Message type (header, success, error, info, stamp)
 * @param {string} message - The message to display
 */
const logNeoEdo = (type, message) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`%c${message}`, consoleStyles[type] || consoleStyles.info);
  }
};

/**
 * Displays the system initialization banner
 */
const displayBanner = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`%c
╔═══════════════════════════════════════════╗
║                                           ║
║     ▄█     █▄   ▄█      ███     ███▄▄▄▄   ║
║    ███     ███ ███  ▀█████████▄ ███▀▀▀██▄ ║
║    ███     ███ ███▌    ▀███▀▀██ ███   ███ ║
║    ███     ███ ███▌     ███   ▀ ███   ███ ║
║    ███     ███ ███▌     ███     ███   ███ ║
║    ███     ███ ███      ███     ███   ███ ║
║    ███ ▄█▄ ███ ███      ███     ███   ███ ║
║     ▀███▀███▀  █▀      ▄████▀    ▀█   █▀  ║
║                                           ║
║          S K E T C H   S Y S T E M        ║
║                                           ║
║     Forensic AI Portrait Generation       ║
║           Version ${VERSION}                  ║
║                                           ║
╚═══════════════════════════════════════════╝
    `, `
      color: #B33A3A;
      font-family: 'Courier New', monospace;
      font-size: 10px;
      line-height: 1.2;
    `);
  }
};

// Display initialization banner
displayBanner();
logNeoEdo('header', `${SYSTEM_NAME} // FIREBASE INITIALIZATION`);
logNeoEdo('info', '────────────────────────────────────────');

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  FIREBASE APP INITIALIZATION                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

let app;
let auth;
let db;

try {
  // Initialize Firebase App
  logNeoEdo('info', '◈ Initializing Firebase application...');
  app = initializeApp(firebaseConfig);
  logNeoEdo('success', '◉ Firebase App: CONNECTED');

  // Initialize Firebase Authentication
  logNeoEdo('info', '◈ Establishing authentication channel...');
  auth = getAuth(app);
  logNeoEdo('success', '◉ Firebase Auth: READY');

  // Initialize Firestore Database
  logNeoEdo('info', '◈ Connecting to Firestore database...');
  db = getFirestore(app);
  logNeoEdo('success', '◉ Firestore DB: ONLINE');

  logNeoEdo('info', '────────────────────────────────────────');
  logNeoEdo('stamp', 'SYSTEM READY');

} catch (initError) {
  logNeoEdo('error', `✕ INITIALIZATION FAILED: ${initError.message}`);
  logNeoEdo('info', '────────────────────────────────────────');
  logNeoEdo('error', 'The system could not establish connection.');
  throw initError;
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  AUTHENTICATION PERSISTENCE                                                 │
// │  ──────────────────────────                                                 │
// │  Maintain session across browser restarts.                                  │
// │  Like a ronin remembering their path.                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

const initializePersistence = async () => {
  try {
    await auth.setPersistence(browserLocalPersistence);
    logNeoEdo('success', '◉ Session Persistence: LOCAL');
  } catch (persistenceError) {
    logNeoEdo('error', `✕ Persistence Error: ${persistenceError.message}`);
    
    // Provide detailed error information in development
    if (process.env.NODE_ENV === 'development') {
      console.group('%c Error Details ', consoleStyles.error);
      console.error('Code:', persistenceError.code);
      console.error('Message:', persistenceError.message);
      console.groupEnd();
    }
  }
};

// Execute persistence initialization
initializePersistence();

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  UTILITY FUNCTIONS                                                          │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Returns the current authentication state
 * @returns {Promise<Object|null>} Current user or null
 */
export const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
};

/**
 * Checks if the Firebase connection is healthy
 * @returns {boolean} Connection status
 */
export const isConnected = () => {
  return app !== null && auth !== null && db !== null;
};
export const storage = getStorage(app);

/**
 * Returns system information for debugging
 * @returns {Object} System status object
 */
export const getSystemStatus = () => ({
  name: SYSTEM_NAME,
  version: VERSION,
  firebase: {
    app: app ? 'initialized' : 'failed',
    auth: auth ? 'ready' : 'failed',
    firestore: db ? 'connected' : 'failed',
  },
  timestamp: new Date().toISOString(),
});

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  EXPORTS                                                                    │
// │  ───────                                                                    │
// │  "A sword is only as good as the one who wields it."                        │
// │  These exports arm your components with Firebase power.                     │
// └─────────────────────────────────────────────────────────────────────────────┘

export { auth, db };
export default app;

// ═══════════════════════════════════════════════════════════════════════════════
//  END OF FIREBASE CONFIGURATION
//  ─────────────────────────────
//  "In the midst of chaos, there is also opportunity." - Sun Tzu
// ═══════════════════════════════════════════════════════════════════════════════