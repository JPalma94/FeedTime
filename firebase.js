import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  runTransaction,
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
  onSnapshot,
  query,
  runTransaction,
};
