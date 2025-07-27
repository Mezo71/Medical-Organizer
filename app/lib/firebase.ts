import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBAn-UcLJugfnMg67nHI49hncU__3l_-ns", // لا تغير القيم هنا، فقط كمّله
  authDomain: "medical-test-organizer-app.firebaseapp.com",
  projectId: "medical-test-organizer-app",
  storageBucket: "medical-test-organizer-app.appspot.com",
  messagingSenderId: "575476400044",
  appId: "1:575476400044:web:2eaf0cc5616e4038078409"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // ← تأكد أنه موجود هنا

export { auth, db, storage };
export { firebaseConfig };
