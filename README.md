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
