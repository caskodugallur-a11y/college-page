/* --------------------------------------------------------------------------
   Firebase Configuration — IHRD CAS Kodungallur
   -----------------------------------------------------------------------
   IMPORTANT: Replace the placeholder values below with your actual Firebase
   project config BEFORE opening this website in any browser.

   To get these values:
     1. Go to https://console.firebase.google.com
     2. Open your project → Project Settings (gear icon)
     3. Scroll to "Your apps" → select your Web App (or add one)
     4. Copy the firebaseConfig object shown there

   These are PUBLIC keys — safe to include in frontend code.
   NEVER put service account keys, admin SDK credentials, or passwords here.
   -------------------------------------------------------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyAK5ndUj3sGvxF5RVC_sGN_1jzyrsj5ItE",
  authDomain: "cask-kodungallur-1.firebaseapp.com",
  projectId: "cask-kodungallur-1",
  storageBucket: "cask-kodungallur-1.firebasestorage.app",
  messagingSenderId: "450132962958",
  appId: "1:450132962958:web:9f4e7127522472cbb423df",
  measurementId: "G-FE1K9E2Y9P"      
};

/* Export so other scripts can import it */
window.CASK_FIREBASE_CONFIG = firebaseConfig;
