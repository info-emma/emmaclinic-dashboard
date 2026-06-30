# แก้ปัญหา 404 บน Vercel สำหรับ React SPA

## ปัญหาคืออะไร?

เว็บที่ใช้ React Router (SPA) จัดการ URL ทั้งหมดใน browser
แต่เวลาพิมพ์ URL ตรงๆ เช่น `myapp.vercel.app/dashboard` → browser ขอไฟล์ `/dashboard` จาก server จริง → ไฟล์ไม่มี → **404**

---

## สาเหตุที่ 1 — ไม่มี SPA Fallback บน Server

### วิธีแก้

สร้างไฟล์ `vercel.json` ที่ root ของ project:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

ทุก URL ที่หาไฟล์ไม่เจอ → rewrite ไปที่ `index.html` → React Router รับต่อเอง

> หมายเหตุ: ใช้ `rewrites` ไม่ใช่ `redirects` — rewrites เป็น server-side (URL ไม่เปลี่ยน), redirects เป็น client-side (URL เปลี่ยน)

---

## สาเหตุที่ 2 — Vercel บล็อก Deploy เพราะ Git Email ผิด (Hobby Plan)

### อาการ

- Vercel Dashboard แสดง **"Deployment Blocked"**
- ข้อความ: *"GitHub could not associate the committer with a GitHub user"*
- Duration แสดงเป็น `—` หรือ `?` (ไม่ได้ build เลย)

### สาเหตุ

Vercel Hobby Plan (free) ไม่รองรับ collaboration — ถ้า email ใน git commit ไม่ตรงกับ GitHub account ที่ connect กับ Vercel จะถูกบล็อกทันที

เกิดบ่อยเมื่อ: ให้ AI ช่วย commit/deploy แทน เพราะ local git config อาจมี email ผิดหรือเป็น placeholder

### วิธีแก้

ตรวจสอบ git email ก่อน commit เสมอ:

```bash
# ตรวจสอบ
git config user.email
git config user.name

# แก้ไข (เฉพาะ repo นี้)
git config user.email "your-github-email@gmail.com"
git config user.name "your-github-username"
```

---

## Checklist เมื่อเจอ 404 บน Vercel

1. **มี `vercel.json` ใน root ไหม?**
   - ไม่มี → สร้างตาม [สาเหตุที่ 1](#สาเหตุที่-1--ไม่มี-spa-fallback-บน-server)

2. **Deploy ผ่านหรือเปล่า?**
   - เข้า Vercel Dashboard → Deployments → คลิก deployment ล่าสุด
   - ถ้าแสดง **"Blocked"** → แก้ git email ตาม [สาเหตุที่ 2](#สาเหตุที่-2--vercel-บล็อก-deploy-เพราะ-git-email-ผิด-hobby-plan)
   - ถ้าแสดง **"Error"** พร้อม build log → ดู log หา error จริง

3. **Deploy ผ่านแล้วแต่ยัง 404?**
   - `vercel.json` อาจไม่ได้ถูก apply → force rebuild โดยแก้ไขไฟล์ source จริงแล้ว push ใหม่ (อย่าใช้ empty commit)

---

## Framework อื่นที่ใช้ได้ด้วยวิธีเดียวกัน

| Framework | ไฟล์ที่ต้องสร้าง |
|-----------|----------------|
| Vercel | `vercel.json` (ตามด้านบน) |
| Netlify | `public/_redirects` → เพิ่มบรรทัด `/* /index.html 200` |
| GitHub Pages | ใช้ HashRouter แทน BrowserRouter หรือ custom 404.html |
| Nginx | `try_files $uri $uri/ /index.html;` ใน config |
