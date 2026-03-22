"use client";
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type Auth
} from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
  getFirestore,
  type Firestore
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Stub values for SSR — Firebase must only run on the client
let app: FirebaseApp = {} as FirebaseApp;
let db: Firestore = {} as Firestore;
let auth: Auth = {} as Auth;
let storage: FirebaseStorage = {} as FirebaseStorage;

if (typeof window !== "undefined") {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    // Firestore with memory cache only (no IndexedDB / disk persistence)
    initializeFirestore(app, { localCache: memoryLocalCache() });
  } else {
    app = getApp();
  }
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  setPersistence(auth, browserSessionPersistence);
}

const provider = new GoogleAuthProvider();

export { app, db, auth, storage, provider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, connectFirestoreEmulator };
