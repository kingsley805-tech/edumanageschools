A comprehensive, idempotent database seeding script has been created in [`backend/prisma/seed.ts`](file:///Users/papakofi/Downloads/edumanageschools/backend/prisma/seed.ts) and configured in [`backend/package.json`](file:///Users/papakofi/Downloads/edumanageschools/backend/package.json).

---

### How to Run the Seed

Make sure your PostgreSQL database is running and tables are created (via `npm run prisma:migrate` or `npx prisma db push`), then run:

```bash
cd backend
npm run prisma:seed
```
*(or `npx prisma db seed`)*

---

### What Was Seeded

#### 1. Platform Super Administrator (Universal Access)
- **Email**: `superadmin@edumanage.com`
- **Password**: `Password123!`
- **Role**: `super_admin` (Universal platform access across both schools)

---

#### 2. Subscription Packages
- **Enterprise School Suite** (Code: `ENTERPRISE` | GHS 2,500/term | up to 1,500 students)
- **Standard Pro** (Code: `STANDARD` | USD 1,200/term | up to 500 students)

---

#### 2. School 1: St. Augustine Academy (`SAA`)
- **Profile**: Local curriculum, GHS currency, Active Enterprise Subscription.
- **Academic Year**: `2025/2026` — `Term 1` (Active).
- **Classes**: `Basic 7 Alpha`, `Basic 8 Alpha`.
- **Subjects**: `Mathematics`, `English Language`, `Integrated Science` (assigned to classes and teachers).
- **Attendance**: Daily register for Basic 7 Alpha with student attendance records.
- **Billing**: Tuition and PTA fee structures, student invoice (`INV-SAA-2025-001`), and a Mobile Money payment receipt.
- **Announcements**: Welcome term announcement.

**Logins (Password: `Password123!`):**
| Role | Name | Email | Details |
|---|---|---|---|
| **Admin** | Rev. Emmanuel Mensah | `admin@staugustine.edu` | Headmaster |
| **Teacher** | Kwame Asante | `kwame.asante@staugustine.edu` | Math & Science (`TCH-SAA-001`) |
| **Teacher** | Grace Boateng | `grace.boateng@staugustine.edu` | English (`TCH-SAA-002`) |
| **Student** | Kofi Owusu | `kofi.owusu@staugustine.edu` | Basic 7A (`STU-SAA-2025-001`) |
| **Student** | Ama Serwaa | `ama.serwaa@staugustine.edu` | Basic 7A (`STU-SAA-2025-002`) |
| **Parent** | Kwabena Owusu | `kwabena.owusu@gmail.com` | Father of Kofi Owusu |

---

#### 3. School 2: Ridgefield International School (`RIS`)
- **Profile**: Cambridge IGCSE curriculum, USD currency, Active Standard Subscription.
- **Academic Year**: `2025/2026` — `Semester 1` (Active).
- **Classes**: `Grade 10 Cambridge`, `Grade 11 Cambridge`.
- **Subjects**: `IGCSE Physics`, `IGCSE English Literature` (assigned to classes and teachers).
- **Attendance**: Daily register for Grade 10 with attendance records.
- **Billing**: Cambridge tuition & STEM lab fee structures, student invoice (`INV-RIS-2025-001`), and full wire transfer payment receipt.
- **Announcements**: Orientation week notice.

**Logins (Password: `Password123!`):**
| Role | Name | Email | Details |
|---|---|---|---|
| **Admin** | Dr. Victoria Osei | `admin@ridgefield.edu` | Principal |
| **Teacher** | David Appiah | `david.appiah@ridgefield.edu` | Physics (`TCH-RIS-001`) |
| **Teacher** | Sarah Addison | `sarah.addison@ridgefield.edu` | Literature (`TCH-RIS-002`) |
| **Student** | Michael Osei | `michael.osei@ridgefield.edu` | Grade 10 (`STU-RIS-2025-001`) |
| **Student** | Abena Mensah | `abena.mensah@ridgefield.edu` | Grade 10 (`STU-RIS-2025-002`) |
| **Parent** | Samuel Mensah | `samuel.mensah@gmail.com` | Father of Abena Mensah |

---

### Features of the Seeding Script
- **Idempotent**: Can be re-run at any time without duplicate key conflicts (it cleanly wipes and refreshes previous dummy data).
- **Auth Ready**: All passwords are encrypted with `bcrypt` (10 rounds) and match the validation logic in [`AuthService`](file:///Users/papakofi/Downloads/edumanageschools/backend/src/modules/auth/auth.service.ts).
- **Multi-Tenant Tested**: Cross-school references and roles are strictly partitioned by `schoolId`.