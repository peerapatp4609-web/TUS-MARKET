# TUS-MARKET

ตลาดนัดออนไลน์สำหรับนักเรียน TUS

## โครงสร้าง production

- `public/app.html` — เว็บแอป production ตัวเดียว
- `public/index.html` — หน้าเข้าเว็บ
- `public/assets/` — ไฟล์ประกอบเว็บ
- `firebase.json` — Firebase Hosting + Firestore
- `firestore.rules` — กฎความปลอดภัย Firestore
- `firestore.indexes.json` — ดัชนีระบบแชต
- `.firebaserc` — Firebase project `tus-market`
- `.github/workflows/firebase-hosting-merge.yml` — workflow deploy ตัวเดียว

ระบบ production ใช้ Firebase เป็นระบบหลัก ทั้ง Hosting, Firestore และ Authentication

## การทดสอบและ deploy

ใช้ Node.js 22 และ Java 21 จากนั้นรัน `npm ci` และ `npm test`
การทดสอบใช้ Firestore Emulator ในโปรเจกต์ demo ไม่แตะฐานข้อมูลจริง

เมื่อ push เข้า main ระบบทดสอบก่อน deploy Hosting, Firestore Rules และ indexes พร้อมกัน
service account ใน secret `FIREBASE_SERVICE_ACCOUNT_TUS_MARKET` ต้องมีสิทธิ์ deploy ทั้ง Hosting และ Firestore

เมื่อผู้ขายแก้ไขสินค้า สินค้าจะกลับไปรอตรวจสอบก่อนเผยแพร่อีกครั้ง
บทสนทนาของสินค้าที่ถูกลบยังเปิดอ่านประวัติได้ แต่ส่งข้อความใหม่ไม่ได้
