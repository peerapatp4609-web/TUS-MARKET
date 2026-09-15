# TUS-MARKET

ตลาดนัดออนไลน์สำหรับนักเรียน TUS

## โครงสร้างหลัก

- `public/tus-market.html` — เว็บแอปตัวหลัก
- `public/index.html` — หน้าเริ่มต้นของเว็บ
- `public/assets/` — รูปและไฟล์ประกอบเว็บ
- `firestore.rules` — กฎความปลอดภัย Firestore
- `firestore.indexes.json` — ดัชนีสำหรับระบบแชต
- `firebase.json` — การตั้งค่า Firebase Hosting และ Firestore
- `.firebaserc` — ระบุ Firebase project `tus-market`
- `.github/workflows/firebase-hosting-merge.yml` — workflow เดียวสำหรับตรวจสอบ/ปรับปรุง source และ deploy Firebase

ระบบ production ใช้ Firebase เป็นหลัก และไม่มี Netlify หรือ GitHub Pages workflow สำหรับเว็บตัวนี้
