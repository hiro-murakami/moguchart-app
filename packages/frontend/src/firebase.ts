import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig)

// Get instances
const auth: Auth = getAuth(app)
const functions: Functions = getFunctions(app, 'asia-northeast1')
const db: Firestore = getFirestore(app)

// Connect to emulators if in mock mode
if (import.meta.env.VITE_APP_MODE === 'mock') {
  // connectAuthEmulator(auth, 'http://localhost:9099'); // 必要ならコメントアウトを外す
  connectFunctionsEmulator(functions, 'localhost', 5001)
  connectFirestoreEmulator(db, 'localhost', 8080)
}

export { app, auth, functions, db }
