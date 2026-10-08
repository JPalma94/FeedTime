import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  runTransaction,
  startAfter,
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCjoIEZnPaWOjfqBh2QnnsCUz_kdWIOAQQ',
  authDomain: 'feedtime.firebaseapp.com',
  projectId: 'feedtime',
  storageBucket: 'feedtime.firebasestorage.app',
  messagingSenderId: '79735451728',
  appId: '1:79735451728:web:ddf13fd70d83e681716155',
};

const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export {
  addDoc,
  collection,
  db,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  startAfter,
};
