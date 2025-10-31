// This configuration works in Vercel (server and client) and Firebase Studio (local) environments.
// It prioritizes server-side variables for build processes and falls back to client-side
// and then to default values.

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyApOJYmEhgqSTh6OD2uVgI9kSvXqdo9Hok",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-7673683321-c816a.firebaseapp.com",
  projectId: 
    process.env.FIREBASE_PROJECT_ID || // Vercel Server (build time)
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || // Vercel Client (browser)
    "studio-7673683321-c816a", // Firebase Studio (local)
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-7673683321-c816a.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "490835418667",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:490835418667:web:8e1f91310894fbccae946e",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-M9C53VZS8Y"
};
