# EduManage NestJS + PostgreSQL Backend

A modular, enterprise-grade multi-tenant REST API built with **NestJS**, **Prisma ORM**, and **PostgreSQL**, designed to replace Supabase in the EduManage School Management System.

---

## 🏗️ Architecture Highlights

- **Framework**: [NestJS 10](https://nestjs.com/) (TypeScript, Express)
- **Database ORM**: [Prisma](https://www.prisma.io/) targeting PostgreSQL 16
- **Multi-Tenancy**: Tenant-isolated by `school_id` with `TenantGuard` and `@CurrentSchool()` decorator
- **Authentication**: JWT access tokens + rotating refresh tokens + bcrypt password hashing
- **Role-Based Access Control (RBAC)**: `RolesGuard` supporting `admin`, `teacher`, `student`, `parent`, and `super_admin`
- **Documentation**: Automatic OpenAPI (Swagger) UI at `/docs`
- **Containerization**: Multi-stage `Dockerfile` + `docker-compose.yml` with bundled PostgreSQL 16

---

## 📁 Project Structure

```text
backend/
├── Dockerfile
├── docker-compose.yml
├── nest-cli.json
├── package.json
├── tsconfig.json
├── .env.example
├── prisma/
│   └── schema.prisma         # Multi-tenant schema models
└── src/
    ├── app.module.ts
    ├── main.ts
    ├── common/
    │   ├── decorators/       # @CurrentUser, @CurrentSchool, @Roles, @Public
    │   ├── guards/           # JwtAuthGuard, RolesGuard, TenantGuard
    │   ├── filters/          # AllExceptionsFilter
    │   └── interceptors/     # TransformInterceptor
    ├── database/
    │   ├── prisma.service.ts
    │   └── database.module.ts
    └── modules/
        ├── auth/             # Login, Admin Registration, Refresh, Profile (/api/v1/auth)
        ├── academics/        # Classes, Subjects, Attendance, Report Cards (/api/v1/academics)
        └── billing/          # Invoices, Payments, POS Receipts, Paystack (/api/v1/billing)
```

---

## 🚀 Quick Start (Local Docker)

### 1. Start PostgreSQL & NestJS Services
```bash
cd backend
cp .env.example .env
docker compose up -d
```

### 2. Run Prisma Migration & Seed
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 3. Access Swagger API Documentation
Open your browser at:
👉 **[http://localhost:4000/docs](http://localhost:4000/docs)**

---

## 📡 REST API Endpoint Contract

### 🔐 Authentication (`/api/v1/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials and returns JWT access + refresh tokens |
| `POST` | `/api/v1/auth/register-admin` | Public | Registers a new institution and root administrator account |
| `POST` | `/api/v1/auth/refresh` | Public | Exchanges a refresh token for a fresh access token |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieves active user profile, assigned roles, and school details |

### 📚 Academics (`/api/v1/academics`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/academics/classes` | Authenticated | Lists all classes with student counts |
| `POST` | `/api/v1/academics/classes` | Admin | Creates a new class/grade level |
| `GET` | `/api/v1/academics/classes/:id` | Authenticated | Retrieves class details, assigned subjects, and enrolled students |
| `GET` | `/api/v1/academics/subjects` | Authenticated | Lists school subjects curriculum |
| `POST` | `/api/v1/academics/subjects` | Admin | Registers a new subject code and syllabus |
| `POST` | `/api/v1/academics/classes/:classId/subjects` | Admin | Assigns subject and designated teacher to class |
| `POST` | `/api/v1/academics/attendance` | Admin / Teacher | Submits daily class attendance register entries |
| `GET` | `/api/v1/academics/attendance/class/:classId` | Authenticated | Retrieves past attendance register history |
| `POST` | `/api/v1/academics/report-cards` | Admin / Teacher | Upserts term report card results and teacher comments |
| `GET` | `/api/v1/academics/report-cards` | Authenticated | Queries term report cards by academic year/student/class |

### 💳 Billing & Finance (`/api/v1/billing`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/billing/invoices` | Authenticated | Queries school invoices with status/student filters |
| `POST` | `/api/v1/billing/invoices` | Admin | Issues new student tuition and fee invoice with line items |
| `GET` | `/api/v1/billing/invoices/:id` | Authenticated | Fetches invoice breakdown, line items, and payment receipts |
| `POST` | `/api/v1/billing/payments` | Admin | Records manual/POS/bank cash payment receipt against invoice |
| `GET` | `/api/v1/billing/stats` | Admin | Returns financial KPI summary (invoiced, collected, balance) |
| `POST` | `/api/v1/billing/checkout/paystack` | Authenticated | Initializes Paystack payment gateway checkout session |
