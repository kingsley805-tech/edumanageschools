# School Management System - Technical Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [User Roles & Permissions](#user-roles--permissions)
7. [Key Features](#key-features)
8. [Workflows](#workflows)
9. [API & Edge Functions](#api--edge-functions)
10. [Security](#security)
11. [Deployment](#deployment)

---

## System Overview

This is a comprehensive **multi-tenant school management system** built for managing educational institutions. The system supports multiple schools, each with their own administrators, teachers, students, and parents. It provides features for academic management, attendance tracking, fee collection, online examinations, and communication.

### Key Characteristics
- **Multi-tenant**: Each school operates independently with its own data
- **Role-based**: Four distinct user roles (Admin, Teacher, Parent, Student)
- **Real-time**: Live updates for messages, notifications, and attendance
- **Secure**: Row-level security (RLS) ensures data isolation between schools
- **Payment-enabled**: Integrated Stripe payment processing for fee collection

---

## Technology Stack

### Frontend
- **React 18.3.1** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router v6** - Client-side routing
- **TanStack Query (React Query)** - Server state management
- **shadcn/ui** - UI component library
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication (Supabase Auth)
  - Row Level Security (RLS)
  - Edge Functions (Deno runtime)
  - Real-time subscriptions

### Payment Processing
- **Stripe** - Payment gateway integration
- **@stripe/stripe-js** - Stripe client SDK

### Additional Libraries
- **React Hook Form** + **Zod** - Form validation
- **date-fns** - Date manipulation
- **recharts** - Data visualization
- **@react-pdf/renderer** - PDF generation (report cards)

---

## Architecture

### Application Structure

```
school-hub/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── DashboardLayout.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── ...
│   ├── contexts/            # React contexts
│   │   └── AuthContext.tsx  # Authentication state
│   ├── hooks/               # Custom React hooks
│   │   ├── useUserRole.ts
│   │   ├── useStudentData.ts
│   │   └── ...
│   ├── integrations/        # External service integrations
│   │   └── supabase/
│   │       ├── client.ts    # Supabase client instance
│   │       └── types.ts    # Generated TypeScript types
│   ├── pages/               # Page components
│   │   ├── admin/           # Admin-only pages
│   │   ├── teacher/         # Teacher pages
│   │   ├── parent/          # Parent pages
│   │   ├── student/         # Student pages
│   │   └── ...
│   └── App.tsx              # Main app component with routing
├── supabase/
│   ├── migrations/          # Database migration files
│   ├── functions/           # Edge Functions
│   │   ├── create-payment-intent/
│   │   ├── create-user-account/
│   │   └── stripe-webhook/
│   └── config.toml          # Supabase configuration
└── public/                  # Static assets
```

### Data Flow

1. **User Authentication**: Supabase Auth handles login/signup
2. **Database Triggers**: `handle_new_user()` trigger creates profile and role records
3. **RLS Policies**: Automatically filter data based on user role and school
4. **Frontend Queries**: React Query fetches and caches data from Supabase
5. **Real-time Updates**: Supabase subscriptions for live data updates

---

## Database Schema

### Core Tables

#### `schools`
Multi-tenancy foundation. Each school has a unique code.
```sql
- id (UUID, PK)
- school_code (TEXT, UNIQUE)
- school_name (TEXT)
- is_active (BOOLEAN)
- created_at (TIMESTAMPTZ)
```

#### `profiles`
User profile information linked to Supabase Auth.
```sql
- id (UUID, PK, FK -> auth.users)
- email (TEXT)
- full_name (TEXT)
- phone (TEXT)
- avatar_url (TEXT)
- school_id (UUID, FK -> schools)
- created_at, updated_at (TIMESTAMPTZ)
```

#### `user_roles`
Defines user roles (one user can have multiple roles in theory, but typically one).
```sql
- id (UUID, PK)
- user_id (UUID, FK -> auth.users)
- role (app_role ENUM: 'admin', 'teacher', 'parent', 'student')
```

### Role-Specific Tables

#### `students`
```sql
- id (UUID, PK)
- user_id (UUID, FK -> profiles, UNIQUE)
- school_id (UUID, FK -> schools)
- admission_no (TEXT, UNIQUE)
- date_of_birth (DATE)
- gender (TEXT)
- class_id (UUID, FK -> classes)
- guardian_id (UUID, FK -> parents)
```

#### `teachers`
```sql
- id (UUID, PK)
- user_id (UUID, FK -> profiles, UNIQUE)
- school_id (UUID, FK -> schools)
- employee_no (TEXT, UNIQUE)
- subject_specialty (TEXT)
```

#### `parents`
```sql
- id (UUID, PK)
- user_id (UUID, FK -> profiles, UNIQUE)
- school_id (UUID, FK -> schools)
- address (TEXT)
```

### Academic Tables

#### `classes`
```sql
- id (UUID, PK)
- name (TEXT)
- level (TEXT)
- school_id (UUID, FK -> schools)
```

#### `subjects`
```sql
- id (UUID, PK)
- name (TEXT)
- code (TEXT)
- school_id (UUID, FK -> schools)
```

#### `class_subjects`
Links classes to subjects and assigns teachers.
```sql
- id (UUID, PK)
- class_id (UUID, FK -> classes)
- subject_id (UUID, FK -> subjects)
- teacher_id (UUID, FK -> teachers)
```

#### `enrollments`
Student-class enrollment records.
```sql
- id (UUID, PK)
- student_id (UUID, FK -> students)
- class_id (UUID, FK -> classes)
- enrolled_on (DATE)
- status (TEXT) -- 'active', 'inactive', etc.
```

### Assessment Tables

#### `assignments`
```sql
- id (UUID, PK)
- title (TEXT)
- description (TEXT)
- class_id (UUID, FK -> classes)
- subject_id (UUID, FK -> subjects)
- due_date (TIMESTAMPTZ)
- created_by (UUID, FK -> auth.users)
```

#### `submissions`
```sql
- id (UUID, PK)
- assignment_id (UUID, FK -> assignments)
- student_id (UUID, FK -> students)
- file_url (TEXT)
- submitted_at (TIMESTAMPTZ)
- grade (NUMERIC)
```

#### `grades`
```sql
- id (UUID, PK)
- student_id (UUID, FK -> students)
- subject_id (UUID, FK -> subjects)
- term (TEXT)
- score (NUMERIC)
```

#### `exams` & `exam_results`
Traditional exam management.

### Online Exam System

#### `question_bank`
```sql
- id (UUID, PK)
- school_id (UUID, FK -> schools)
- subject_id (UUID, FK -> subjects)
- question_type (TEXT) -- 'multiple_choice', 'true_false', 'fill_blank'
- question_text (TEXT)
- options (JSONB) -- For MCQ: [{id: 1, text: "Option A"}, ...]
- correct_answer (TEXT)
- marks (NUMERIC)
- difficulty (TEXT) -- 'easy', 'medium', 'hard'
- created_by (UUID, FK -> auth.users)
```

#### `online_exams`
```sql
- id (UUID, PK)
- title (TEXT)
- description (TEXT)
- class_id (UUID, FK -> classes)
- subject_id (UUID, FK -> subjects)
- exam_type_id (UUID, FK -> exam_types)
- start_time (TIMESTAMPTZ)
- end_time (TIMESTAMPTZ)
- duration_minutes (INTEGER)
- total_marks (NUMERIC)
- passing_marks (NUMERIC)
- shuffle_questions (BOOLEAN)
- show_result_immediately (BOOLEAN)
- term (TEXT)
- created_by (UUID, FK -> auth.users)
```

#### `online_exam_questions`
Links questions to exams.
```sql
- id (UUID, PK)
- online_exam_id (UUID, FK -> online_exams)
- question_id (UUID, FK -> question_bank)
- question_order (INTEGER)
- marks (NUMERIC)
```

#### `online_exam_attempts`
```sql
- id (UUID, PK)
- online_exam_id (UUID, FK -> online_exams)
- student_id (UUID, FK -> students)
- started_at (TIMESTAMPTZ)
- submitted_at (TIMESTAMPTZ)
- total_marks_obtained (NUMERIC)
- status (TEXT) -- 'in_progress', 'submitted', 'graded'
- UNIQUE(online_exam_id, student_id)
```

#### `online_exam_answers`
```sql
- id (UUID, PK)
- attempt_id (UUID, FK -> online_exam_attempts)
- question_id (UUID, FK -> question_bank)
- student_answer (TEXT)
- is_correct (BOOLEAN)
- marks_obtained (NUMERIC)
```

### Attendance

#### `attendance`
```sql
- id (UUID, PK)
- student_id (UUID, FK -> students)
- class_id (UUID, FK -> classes)
- date (DATE)
- status (TEXT) -- 'present', 'absent', 'late'
- recorded_by (UUID, FK -> auth.users)
- recorded_at (TIMESTAMPTZ)
```

### Financial Tables

#### `fee_structures`
```sql
- id (UUID, PK)
- name (TEXT)
- description (TEXT)
- amount (NUMERIC)
- school_id (UUID, FK -> schools)
```

#### `invoices`
```sql
- id (UUID, PK)
- invoice_no (TEXT, UNIQUE)
- student_id (UUID, FK -> students)
- fee_structure_id (UUID, FK -> fee_structures)
- amount (NUMERIC)
- status (TEXT) -- 'unpaid', 'paid', 'overdue'
- due_date (DATE)
```

#### `payments`
```sql
- id (UUID, PK)
- invoice_id (UUID, FK -> invoices)
- payer_user_id (UUID, FK -> auth.users)
- amount (NUMERIC)
- payment_provider (TEXT) -- 'stripe'
- provider_reference (TEXT) -- Stripe payment intent ID
- status (TEXT) -- 'pending', 'completed', 'failed'
```

### Communication Tables

#### `messages`
```sql
- id (UUID, PK)
- sender_id (UUID, FK -> auth.users)
- receiver_id (UUID, FK -> auth.users)
- subject (TEXT)
- body (TEXT)
- read (BOOLEAN)
- created_at (TIMESTAMPTZ)
```

#### `notifications`
```sql
- id (UUID, PK)
- user_id (UUID, FK -> auth.users)
- title (TEXT)
- body (TEXT)
- data (JSONB)
- read (BOOLEAN)
- created_at (TIMESTAMPTZ)
```

#### `announcements`
```sql
- id (UUID, PK)
- title (TEXT)
- body (TEXT)
- priority (TEXT)
- target_roles (TEXT[]) -- Array of roles
- created_by (UUID, FK -> auth.users)
- created_at (TIMESTAMPTZ)
```

### Grading Configuration

#### `exam_types`
```sql
- id (UUID, PK)
- name (TEXT) -- 'Quiz', 'Midterm', 'Final', etc.
- school_id (UUID, FK -> schools)
```

#### `grade_scales`
```sql
- id (UUID, PK)
- name (TEXT)
- min_score (NUMERIC)
- max_score (NUMERIC)
- grade (TEXT) -- 'A', 'B', 'C', etc.
- school_id (UUID, FK -> schools)
```

#### `class_grading_config`
```sql
- id (UUID, PK)
- class_id (UUID, FK -> classes)
- subject_id (UUID, FK -> subjects)
- exam_type_id (UUID, FK -> exam_types)
- term (TEXT)
- weight_percentage (NUMERIC)
```

---

## Authentication & Authorization

### Authentication Flow

1. **User Registration**
   - User signs up with email, password, role, school_code
   - For admins: also requires `admin_key` and `school_name`
   - Supabase Auth creates user in `auth.users` table
   - Database trigger `handle_new_user()` fires automatically

2. **Trigger Function: `handle_new_user()`**
   ```sql
   - Extracts role and school_code from user metadata
   - For admins:
     * Validates admin_key from vault/environment
     * Creates new school record
     * Validates school_code uniqueness
   - For non-admins:
     * Validates school_code exists and is active
   - Creates profile record with school_id
   - Creates user_roles record
   - Creates role-specific record (students/teachers/parents)
   ```

3. **User Login**
   - Standard email/password authentication via Supabase Auth
   - Session stored in localStorage
   - Auth state managed by `AuthContext`

### Authorization (Row Level Security)

All tables have RLS enabled with policies that enforce:

1. **School Isolation**: Users can only access data from their own school
2. **Role-based Access**: Different permissions based on user role
3. **Relationship-based Access**: Parents see their children's data, teachers see their class data

#### Example RLS Policies

**Students Table:**
- Students can view own profile
- Parents can view their children
- Teachers can view all students (in their school)
- Admins can manage all students (in their school)

**Grades Table:**
- Students can view own grades
- Parents can view children's grades
- Teachers can manage grades
- Admins can view all grades

**Messages Table:**
- Users can view messages where they are sender or receiver
- Users can send messages (as sender)
- Users can update received messages (mark as read)

---

## User Roles & Permissions

### Admin
**Capabilities:**
- Create and manage school (own school only)
- Create user accounts (via Edge Function)
- Manage students, teachers, classes, subjects
- Link parents to students
- Link teachers to classes
- Create fee structures and invoices
- View all reports and analytics
- Manage announcements
- Configure exam types and grade scales
- View all attendance records

**Access:**
- Full CRUD on all entities within their school
- Cannot access other schools' data

### Teacher
**Capabilities:**
- View assigned classes and students
- Record attendance
- Create and grade assignments
- Create and manage question bank
- Create online exams
- Upload resources
- Send messages to parents
- View student grades and performance

**Access:**
- Read/write on their assigned classes
- Can only see students in their classes
- Can only create questions for their subjects

### Parent
**Capabilities:**
- View children's information
- View children's attendance
- View children's grades
- Pay fees via Stripe
- Send messages to teachers
- View announcements

**Access:**
- Read-only on their children's data
- Can create payments for their children's invoices

### Student
**Capabilities:**
- View own schedule
- View and submit assignments
- View own grades
- Take online exams
- Access resources
- View announcements

**Access:**
- Read-only on own data
- Can create submissions for assignments
- Can create exam attempts

---

## Key Features

### 1. Multi-Tenant School Management
- Each school operates independently
- School isolation enforced at database level (RLS)
- School codes used for registration and data filtering

### 2. User Account Management
- Self-registration for all roles
- Admin-created accounts via Edge Function
- Automatic profile and role record creation
- Admin key validation for school creation

### 3. Academic Management
- **Classes**: Organize students by grade/level
- **Subjects**: Subject catalog per school
- **Enrollments**: Student-class relationships
- **Class-Subject Linking**: Assign teachers to teach subjects in classes

### 4. Attendance Tracking
- Daily attendance recording by teachers
- Status: Present, Absent, Late
- Historical attendance records
- Attendance reports for parents and admins

### 5. Assignment Management
- Teachers create assignments for classes/subjects
- Students submit assignments (file uploads)
- Teachers grade submissions
- Due date tracking

### 6. Grading System
- **Traditional Exams**: Manual grade entry
- **Online Exams**: Auto-graded objective questions
- **Grade Scales**: Configurable letter grades
- **Term-based**: Support for multiple terms
- **Weighted Grading**: Configurable exam type weights per class/subject

### 7. Online Examination System
- **Question Bank**: Reusable question repository
  - Multiple choice questions
  - True/False questions
  - Fill-in-the-blank questions
- **Exam Creation**: Teachers create timed exams
- **Student Experience**:
  - Timer countdown
  - Question navigation
  - Auto-submit on time expiry
  - Immediate results (if enabled)
- **Auto-grading**: Objective questions graded automatically
- **Attempt Tracking**: One attempt per student per exam

### 8. Fee Management
- **Fee Structures**: Define fee types (tuition, books, etc.)
- **Invoice Generation**: Create invoices for students
- **Payment Processing**: Stripe integration
  - Payment intents created via Edge Function
  - Webhook updates payment and invoice status
  - Support for multiple payment methods

### 9. Communication
- **Direct Messaging**: Teacher-Parent communication
- **Notifications**: System notifications for users
- **Announcements**: School-wide or role-specific announcements

### 10. Reporting & Analytics
- Dashboard statistics (students, teachers, fees, attendance)
- Class distribution charts
- Recent activity feeds
- Custom reports (admin)

---

## Workflows

### New School Registration (Admin)
1. Admin visits registration page
2. Enters: email, password, full name, school name, school code, admin key
3. System validates admin key (from vault or environment)
4. System checks school code uniqueness
5. Creates auth user
6. Trigger creates:
   - School record
   - Admin profile
   - Admin role record
7. Admin redirected to dashboard

### Student Registration
1. Student enters: email, password, full name, school code
2. System validates school code exists and is active
3. Creates auth user
4. Trigger creates:
   - Student profile (linked to school)
   - Student role record
   - Student record (in students table)
5. Admin later links student to class and parent

### Admin Creates User Account
1. Admin calls `create-user-account` Edge Function
2. Function validates admin is authenticated and has admin role
3. Creates user via Supabase Admin API (auto-confirms email)
4. Trigger creates profile, role, and role-specific records
5. Function updates role-specific fields (employee_no, admission_no, etc.)
6. Returns created user

### Online Exam Workflow
1. **Teacher creates exam:**
   - Selects class, subject, exam type
   - Sets start/end time, duration
   - Adds questions from question bank
   - Saves exam

2. **Student takes exam:**
   - Student sees available exams (within time window)
   - Starts exam → creates attempt record
   - Timer starts countdown
   - Answers questions
   - Submits or auto-submits on expiry

3. **Grading:**
   - System compares answers to correct answers
   - Calculates marks per question
   - Updates attempt with total marks
   - Updates status to 'submitted' or 'graded'

### Payment Workflow
1. **Invoice Creation:**
   - Admin creates invoice for student
   - Invoice status: 'unpaid'

2. **Payment Initiation:**
   - Parent views invoice
   - Clicks "Pay Now"
   - Frontend calls `create-payment-intent` Edge Function
   - Function creates Stripe Payment Intent
   - Function creates payment record (status: 'pending')
   - Returns client secret

3. **Payment Processing:**
   - (In production) Stripe Elements collects card details
   - Stripe processes payment

4. **Payment Completion:**
   - Stripe webhook calls `stripe-webhook` Edge Function
   - Function updates payment status to 'completed'
   - Function updates invoice status to 'paid'

### Attendance Recording
1. Teacher selects class and date
2. System loads enrolled students
3. Teacher marks each student: Present/Absent/Late
4. System creates attendance records
5. Parents and students can view attendance history

---

## API & Edge Functions

### Supabase Edge Functions

#### 1. `create-payment-intent`
**Purpose**: Create Stripe payment intent for invoice payment

**Request:**
```json
{
  "invoiceId": "uuid",
  "amount": 100.00
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx"
}
```

**Process:**
1. Validates request
2. Creates Stripe Payment Intent
3. Creates payment record in database (pending)
4. Returns client secret for Stripe Elements

#### 2. `create-user-account`
**Purpose**: Allow admins to create user accounts programmatically

**Authentication**: Requires admin role

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "full_name": "John Doe",
  "role": "student",
  "school_code": "SCH001",
  "employee_no": "EMP123",  // For teachers
  "admission_no": "ADM456",  // For students
  "date_of_birth": "2010-01-01",  // For students
  "gender": "Male",  // For students
  "guardian_email": "parent@example.com"  // For students
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... }
}
```

**Process:**
1. Validates caller is admin
2. Creates user via Supabase Admin API
3. Waits for trigger to complete
4. Updates role-specific fields if provided

#### 3. `stripe-webhook`
**Purpose**: Handle Stripe webhook events

**Process:**
1. Validates webhook signature
2. Handles `payment_intent.succeeded` event
3. Updates payment status to 'completed'
4. Updates invoice status to 'paid'

---

## Security

### Authentication Security
- Supabase Auth handles password hashing
- JWT tokens for API authentication
- Session management via localStorage
- Email confirmation (configurable)

### Database Security
- **Row Level Security (RLS)**: All tables protected
- **Security Definer Functions**: `has_role()` function for role checks
- **School Isolation**: Users cannot access other schools' data
- **Role-based Policies**: Access controlled by user role

### API Security
- Edge Functions validate authentication
- Admin-only functions check role
- CORS headers configured
- Webhook signature validation (Stripe)

### Data Validation
- Frontend: React Hook Form + Zod schemas
- Backend: Database constraints (UNIQUE, NOT NULL, FK)
- Type safety: TypeScript throughout

---

## Deployment

### Environment Variables

**Frontend (.env):**
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

**Supabase Edge Functions:**
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

**Supabase Vault (for admin key):**
- Store `ADMIN_ID` secret in Supabase Vault
- Or set `app.settings.admin_id` in database settings

### Build & Deploy

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Migrations:**
   ```bash
   supabase db push
   ```

3. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy create-payment-intent
   supabase functions deploy create-user-account
   supabase functions deploy stripe-webhook
   ```

4. **Build Frontend:**
   ```bash
   npm run build
   ```

5. **Deploy Frontend:**
   - Deploy `dist/` folder to hosting (Vercel, Netlify, etc.)
   - Configure environment variables

### Database Migrations

Migrations are located in `supabase/migrations/` and are applied in chronological order. Key migrations:

- `20251130163531_*` - Initial schema
- `20251201233358_*` - Multi-tenancy (schools table)
- `20251201235839_*` - Updated handle_new_user function
- `20251202174919_*` - Online exam system

---

## Development Guidelines

### Adding New Features

1. **Database Changes:**
   - Create migration file in `supabase/migrations/`
   - Add RLS policies
   - Update TypeScript types: `supabase gen types typescript`

2. **Frontend:**
   - Create page component in `src/pages/[role]/`
   - Add route in `src/App.tsx`
   - Add menu item in `DashboardLayout.tsx` if needed

3. **Security:**
   - Always add RLS policies for new tables
   - Consider school_id for multi-tenancy
   - Validate user permissions in Edge Functions

### Code Structure

- **Components**: Reusable UI components in `src/components/`
- **Pages**: Route components in `src/pages/`
- **Hooks**: Custom hooks in `src/hooks/`
- **Contexts**: Global state in `src/contexts/`
- **Types**: Database types in `src/integrations/supabase/types.ts`

### Best Practices

1. Always use TypeScript types from generated types file
2. Use React Query for data fetching
3. Implement proper loading and error states
4. Follow RLS policy patterns for new tables
5. Test multi-tenant isolation
6. Validate inputs on both frontend and backend

---

## Support & Maintenance

### Common Issues

1. **RLS Policy Errors**: Check user role and school_id matches
2. **Trigger Failures**: Check admin key configuration
3. **Payment Issues**: Verify Stripe webhook endpoint
4. **Type Errors**: Regenerate types after schema changes

### Monitoring

- Supabase Dashboard: Database logs, auth logs
- Stripe Dashboard: Payment events, webhook logs
- Application: Browser console, network tab

---

## Future Enhancements

Potential areas for expansion:
- Mobile app (React Native)
- Advanced reporting and analytics
- Bulk operations (bulk student import)
- Calendar integration
- Video conferencing integration
- Parent-teacher conference scheduling
- Library management
- Transportation management
- Hostel/dormitory management

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Maintained by**: Development Team
