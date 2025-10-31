
// Bu yapılandırma Vercel (sunucu ve istemci) ve Firebase Studio (yerel) ortamlarında çalışır.
export const firebaseConfig = {
  // 1. Vercel İstemci (Tarayıcı) - NEXT_PUBLIC_ ile başlar
  // 2. Vercel Sunucu (Build) - NEXT_PUBLIC_ olmadan başlar
  // 3. Firebase Studio (Yerel) - Varsayılan değer
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyApOJYmEhgqSTh6OD2uVgI9kSvXqdo9Hok",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "studio-7673683321-c816a.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "studio-7673683321-c816a",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "studio-7673683321-c816a.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "490835418667",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "1:490835418667:web:8e1f91310894fbccae946e",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID || "G-M9C53VZS8Y"
};
