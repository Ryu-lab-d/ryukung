# คู่มือกู้ร้านเมื่อคอมถูกแฮ็ก / ข้อมูลหาย (RYUKUNG BAKERY POS)

อ่านไฟล์นี้ **ตอนที่ทุกอย่างยังปกติ** แล้วทำข้อ "เตรียมตัวไว้ก่อน" ให้ครบ — ตอนเกิดเหตุจริงจะได้ไม่ต้องคิดเยอะ
ไฟล์นี้อยู่ใน GitHub ของโปรเจกต์ด้วย เปิดดูได้จากมือถือ/เครื่องอื่นแม้เครื่องหลักใช้ไม่ได้

---

## 0) ของแต่ละอย่าง "อยู่ที่ไหน" (ถ้าคอมพัง อะไรยังอยู่)

| ของ | อยู่ที่ | คอมพังแล้วยังอยู่ไหม |
|---|---|---|
| โค้ดเว็บทั้งหมด | GitHub (repo ryukung) | ✅ อยู่ (clone ใหม่ได้) |
| เว็บที่ลูกค้าใช้ | Cloudflare Pages (ryukung-pos.pages.dev) | ✅ อยู่ (ยังทำงานต่อ) |
| ข้อมูลร้าน (ออเดอร์/ลูกค้า/สินค้า/ต้นทุน…) | Supabase (ฐานข้อมูล) | ✅ อยู่ — แต่ถ้าบัญชี Supabase ถูกยึด ข้อมูลอาจถูกลบ → ต้องมีไฟล์สำรองนอกเครื่อง |
| รูปสินค้า/โลโก้ | Supabase Storage | ✅ อยู่ (และอยู่ในไฟล์สำรองด้วย) |
| คีย์ลับ (service role, SMTP, Anthropic, Turnstile) | ไฟล์ `.env.local` ในคอม + Supabase secrets | ⚠️ ในคอม = โจรอาจขโมยได้ → ต้อง "หมุนคีย์" (ข้อ 3) |
| **ไฟล์สำรองข้อมูล** | **ที่คุณเก็บเอง นอกเครื่อง** | ✅ ถ้าทำตามข้อ 1 |

---

## 1) เตรียมตัวไว้ก่อน (ทำครั้งเดียว + ทำซ้ำทุกสัปดาห์)

1. **สำรองข้อมูลทุกสัปดาห์** — เข้าเมนู ตั้งค่า → 🛟 สำรองข้อมูล & ฉุกเฉิน (`/backup`) ตั้งรหัสผ่านไฟล์ (ยาว ≥ 12 ตัว) แล้วกดดาวน์โหลด
   - หรือใช้คำสั่งในเครื่อง: `npm run backup -- <โฟลเดอร์>`
2. **เก็บไฟล์สำรอง "นอกเครื่องนี้" อย่างน้อย 2 ที่** เช่น Google Drive ส่วนตัว (เปิด 2FA) + ฮาร์ดดิสก์/แฟลชไดรฟ์ที่ไม่เสียบค้างไว้ — ไฟล์เข้ารหัสแล้ว ต่อให้หลุดก็อ่านไม่ได้ถ้าไม่มีรหัส
3. **เก็บรหัสผ่านไฟล์สำรองแยกต่างหาก** (ตัวจัดการรหัสผ่าน หรือเขียนใส่กระดาษเก็บในที่ปลอดภัย) — **ลืมรหัส = กู้ไฟล์ไม่ได้ ไม่มีใครช่วยได้ รวมถึงผม**
4. **ลองเปิดไฟล์สำรองสักครั้ง** ที่หน้า `/backup` หัวข้อ "ตรวจว่าไฟล์สำรองเปิดได้จริง" — สำรองที่ไม่เคยทดสอบ ไม่ใช่สำรอง
5. **เปิด 2FA** ทุกบัญชี: อีเมลหลัก, Google, GitHub, Supabase, Cloudflare (ใช้แอป Authenticator ไม่ใช้ SMS ถ้าเลือกได้)
6. **จดรายการบัญชีและอีเมลที่ใช้สมัครแต่ละอย่างไว้ในที่ปลอดภัยนอกเครื่อง** (ไม่ต้องจดรหัสผ่านในรายการนี้ ใช้ตัวจัดการรหัสผ่าน)
7. แยกเบราว์เซอร์/โปรไฟล์สำหรับ "งานแอดมินร้าน" ออกจากเบราว์เซอร์ที่เล่นเน็ตทั่วไป ไม่ให้เบราว์เซอร์จำรหัสผ่านบัญชีสำคัญ
8. **Supabase แผนฟรีไม่มีการสำรองอัตโนมัติ** — ถ้างบพอ พิจารณาแผน Pro (มี daily backup / point-in-time recovery) เป็นชั้นสำรองอีกชั้น แต่ไฟล์สำรองของเราก็ยังควรมี เพราะอยู่นอกระบบ Supabase

---

## 2) ถ้าสงสัยว่าคอมถูกแฮ็ก — 30 นาทีแรก (ทำจาก "มือถือหรือเครื่องอื่นที่สะอาด")

ลำดับสำคัญ ทำตามนี้:

1. **ตัดเน็ตเครื่องนั้นทันที** (ถอดสาย LAN / ปิด Wi-Fi) แล้วอย่าล็อกอินอะไรบนเครื่องนั้นอีก
2. **ปุ่มฉุกเฉิน**: เปิดเว็บร้านบนมือถือ → ตั้งค่า → 🛟 สำรองข้อมูล & ฉุกเฉิน → **🚨 ออกจากระบบทุกอุปกรณ์ทันที**
   (ลบเซสชันของทุกคน โจรที่ค้างล็อกอินอยู่จะถูกเตะออก ทุกคนต้องล็อกอินใหม่)
3. **เปลี่ยนรหัสผ่านอีเมลหลักก่อน** + ออกจากทุกอุปกรณ์ + เปิด 2FA — ใครคุมอีเมลได้ก็กด "ลืมรหัสผ่าน" ยึดทุกบัญชีได้
4. เปลี่ยนรหัสผ่าน + "ออกจากระบบทุกอุปกรณ์" + 2FA ที่: **Google, GitHub, Supabase, Cloudflare**
5. **หมุนคีย์ลับ** (ข้อ 3 ด้านล่าง)
6. เปิด `/audit` (ประวัติกิจกรรม) ดูว่ามีอะไรถูกแก้/ลบ/เชิญพนักงานแปลกๆ ไหม ตรวจรายชื่อพนักงาน ถอดคนที่ไม่รู้จัก
7. ถ้าข้อมูลลูกค้าอาจรั่ว: แจ้งลูกค้าที่เกี่ยวข้อง (กฎหมาย PDPA กำหนดให้แจ้งเหตุ) และเก็บหลักฐาน (ภาพหน้าจอ เวลา)
8. **อย่า** ล้างเครื่องเดิมก่อนถ่ายหลักฐานถ้าต้องแจ้งความ

---

## 3) หมุนคีย์ลับ (หลังโดนแฮ็ก หรือสงสัยว่าคีย์หลุด)

> `.env.local` ในคอมที่ถูกแฮ็กถือว่า "รั่วแล้ว" — ต้องเปลี่ยนทุกค่าในนั้น

| คีย์ | วิธีหมุน |
|---|---|
| **Supabase JWT secret** (ทำให้ anon + service_role key เก่าใช้ไม่ได้) | Supabase Dashboard → Project Settings → **API / JWT Keys** → สร้างคีย์ใหม่ (regenerate) แล้วอัปเดต `VITE_SUPABASE_ANON_KEY` ใน Cloudflare Pages (Settings → Environment variables) และ build/deploy ใหม่ |
| **รหัสผ่านฐานข้อมูล** | Supabase → Project Settings → Database → Reset database password |
| **Personal Access Token ของ Supabase CLI** | Supabase → Account → Access Tokens → ลบทุกอัน แล้ว `npx supabase login` ใหม่บนเครื่องสะอาด |
| **SMTP (รหัสแอป Gmail)** | Google Account → Security → App passwords → ลบอันเก่า สร้างใหม่ แล้ว `npx supabase secrets set SMTP_PASS=…` |
| **Anthropic API key** (แชทบอท) | console.anthropic.com → API keys → ลบอันเก่า สร้างใหม่ แล้ว `npx supabase secrets set ANTHROPIC_API_KEY=…` |
| **Turnstile secret** | Cloudflare → Turnstile → site ของร้าน → Rotate secret แล้ว `npx supabase secrets set TURNSTILE_SECRET_KEY=…` |
| **ความลับ sync Google Sheets** | รัน SQL: `update public.internal_secrets set value = encode(extensions.gen_random_bytes(24),'hex') where name='sheets_sync'` แล้วตั้ง `SHEETS_SYNC_SECRET` ใน Supabase secrets ให้เป็นค่าเดียวกัน (อ่านค่าใหม่จาก `select value from public.internal_secrets`) |
| **ลิงก์ Google Apps Script (webhook ชีต)** | Apps Script → Deploy ใหม่ (ได้ URL ใหม่) แล้ว `npx supabase secrets set GOOGLE_SHEETS_SYNC_WEBHOOK_URL=…` |
| **โทเคน Cloudflare / wrangler** | Cloudflare → My Profile → API Tokens → ลบ แล้ว `npx wrangler logout && npx wrangler login` บนเครื่องสะอาด |
| **GitHub** | Settings → Developer settings → Personal access tokens (ลบทั้งหมด), SSH and GPG keys (ลบของเครื่องเก่า), Applications (ถอนสิทธิ์แอปแปลกๆ) และดูประวัติ commit/โค้ดว่ามีอะไรถูกแก้โดยไม่ใช่เรา (`git log`) |

---

## 4) ตั้งเครื่องใหม่ให้ทำงานต่อได้

```bash
# 1) ติดตั้ง Node.js (LTS) + Git บนเครื่องสะอาด
git clone https://github.com/Ryu-lab-d/ryukung.git
cd ryukung/ryukung-pos   # โฟลเดอร์โปรเจกต์
npm ci
# 2) สร้าง .env.local จาก .env.example แล้วกรอกค่า "ใหม่" (หลังหมุนคีย์ตามข้อ 3)
# 3) ล็อกอินเครื่องมือด้วยบัญชีที่เปลี่ยนรหัสแล้ว
npx supabase login
npx wrangler login
# 4) ทดสอบ/ดีพลอย
npm run build
npx wrangler pages deploy dist --project-name ryukung-pos
```

---

## 5) กู้ข้อมูลจากไฟล์สำรอง

### 5.1 ข้อมูลบางส่วนหาย/ถูกลบ/ถูกแก้ (โปรเจกต์ Supabase เดิมยังอยู่)
```bash
# ซ้อมก่อน (ไม่เขียนอะไร) — ดูว่าไฟล์เปิดได้และมีอะไรบ้าง
npm run restore -- ryukung-backup-2026-xx-xx.enc.json
# กู้จริงทุกตาราง
npm run restore -- ryukung-backup-2026-xx-xx.enc.json --apply
# กู้เฉพาะบางตาราง
npm run restore -- ryukung-backup-2026-xx-xx.enc.json --apply --only=orders,order_items,customers
```
- กู้แบบ "ใส่กลับ/ทับด้วย id เดิม" — **ไม่ลบ** ข้อมูลอื่นที่มีอยู่ จึงปลอดภัยที่จะลองซ้อมก่อน
- ไม่กู้ `staff_members` (พนักงานผูกกับบัญชีผู้ใช้ ต้องเชิญใหม่) และ `audit_log` (ประวัติแก้ย้อนหลังไม่ได้)
- รูปสินค้าในไฟล์สำรองจะถูกอัปโหลดกลับเมื่อใช้ `--apply` ทั้งหมด (หรือ `--only=files`)

### 5.2 กู้ทั้งระบบ (โปรเจกต์ Supabase ถูกลบ/ยึดไปแล้ว → สร้างโปรเจกต์ใหม่)
1. สร้างโปรเจกต์ Supabase ใหม่ (บัญชีที่ปลอดภัย) แล้วผูกกับโปรเจกต์: `npx supabase link --project-ref <ref ใหม่>`
2. สร้างโครงสร้างทั้งหมด: `npx supabase db push` (รัน migration ทุกไฟล์ใน `supabase/migrations`)
3. ตั้ง secrets ใหม่: `npx supabase secrets set SMTP_USER=… SMTP_PASS=… ANTHROPIC_API_KEY=… TURNSTILE_SECRET_KEY=… SHEETS_SYNC_SECRET=…` แล้ว deploy edge functions: `npx supabase functions deploy <ชื่อ> --project-ref <ref> --use-api` (ทุกตัวในโฟลเดอร์ `supabase/functions`)
4. อัปเดต `.env.local` และตัวแปรบน Cloudflare Pages (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) แล้ว deploy เว็บใหม่
5. กู้ข้อมูล: `npm run restore -- <ไฟล์> --apply`
6. สร้างบัญชีเจ้าของใหม่: สมัครผู้ใช้ในหน้าเข้าสู่ระบบด้วยอีเมลเจ้าของ แล้วรัน SQL ในหน้า SQL Editor ของ Supabase:
   ```sql
   update public.staff_members set role = 'owner', status = 'active' where lower(email) = lower('อีเมลเจ้าของ');
   -- ถ้ายังไม่มีแถว (ตารางว่าง) ให้ใช้:
   insert into public.staff_members (user_id, email, display_name, role, status)
   select id, email, 'เจ้าของร้าน', 'owner', 'active' from auth.users where lower(email) = lower('อีเมลเจ้าของ');
   ```
7. เชิญพนักงานใหม่อีกครั้ง (หน้าตั้งค่า → พนักงาน)
8. ตรวจ: เข้าเว็บ `/menu` ได้, ล็อกอินหลังบ้านได้, เปิดออเดอร์เก่าดูได้, ลองสั่งทดสอบหนึ่งออเดอร์

---

## 6) สิ่งที่ระบบนี้ทำให้แล้ว / ที่ต้องทำเอง

**ระบบทำให้:**
- ไฟล์สำรองเข้ารหัส AES-256 (ถอดรหัสไม่ได้ถ้าไม่มีรหัสผ่าน) + ตรวจสอบความถูกต้องในตัว (ไฟล์ถูกแก้ = เปิดไม่ได้)
- สคริปต์สำรอง/กู้คืนที่ทดสอบกับข้อมูลจริงแล้ว
- ปุ่มเตะทุกเซสชันจากมือถือ + ประวัติกิจกรรม (`/audit`) บอกว่าใครทำอะไรเมื่อไหร่
- หน้าสาธารณะและข้อมูลลูกค้าล็อกฝั่งเซิร์ฟเวอร์ (คอมโดนแฮ็กไม่ได้ทำให้ลูกค้าคนนอกเข้าถึงข้อมูลได้)

**ต้องทำเอง (ระบบทำแทนไม่ได้):**
- สำรองสม่ำเสมอ + เก็บไฟล์/รหัสผ่านนอกเครื่อง
- เปิด 2FA ทุกบัญชี และรักษาความปลอดภัยของอีเมลหลัก
- หมุนคีย์หลังเกิดเหตุ
