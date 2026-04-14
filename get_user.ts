import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = query(collection(db, "users"), where("email", "==", "rahmathidayat552@guru.smk.belajar.id"));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    console.log("Guru ID:", snapshot.docs[0].id);
  } else {
    console.log("Guru not found");
  }
  
  const q2 = query(collection(db, "users"), where("role", "==", "SISWA"));
  const snapshot2 = await getDocs(q2);
  if (!snapshot2.empty) {
    console.log("Siswa ID:", snapshot2.docs[0].id);
  } else {
    console.log("Siswa not found");
  }
  process.exit(0);
}
run();
