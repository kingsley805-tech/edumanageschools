# School Management System - Complete Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Core Features](#core-features)
4. [Module Documentation](#module-documentation)
5. [Connecting to External Supabase Backend](#connecting-to-external-supabase-backend)
6. [Database Schema](#database-schema)
7. [Security Considerations](#security-considerations)

---

## System Overview

This is a comprehensive School Management System (SMS) built with modern web technologies:

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Authentication, Edge Functions, Storage)
- **State Management**: React Query (TanStack Query)
- **Form Handling**: React Hook Form with Zod validation

The system supports multiple schools, each with isolated data and their own administrators.

---

## User Roles & Permissions

### 1. Super Admin
- Manages multiple schools
- Can switch between schools they oversee
- Has access to all system features across assigned schools
- Can create and manage school administrators

### 2. Admin (School Administrator)
- Full control over their school's data
- Manages teachers, students, parents
- Creates classes, subjects, exam types
- Configures grade scales and fee structures
- Publishes announcements
- Views comprehensive reports

### 3. Teacher
- Manages assigned classes and subjects only
- Creates and grades assignments
- Records attendance for their classes
- Creates online exams and manages question banks (only for their subjects)
- Views their timetable
- Communicates with students and parents

### 4. Student
- Views their class timetable (downloadable)
- Takes online exams
- Views grades and assignments
- Accesses learning resources
- Receives announcements

### 5. Parent
- Views linked children's information
- Monitors attendance and grades
- Makes fee payments
- Communicates with teachers

---

## Core Features

### Authentication System
- Email/password authentication
- Role-based access control
- School code verification during signup
- Admin key verification for admin registration
- Auto-confirmation of email signups (configurable)

### Multi-School Support
- Each school has a unique school code
- Data isolation between schools using Row-Level Security (RLS)
- School-specific configurations (grade scales, exam types, etc.)

### Timetable Management
- Class-specific timetables
- Teacher schedule views
- Downloadable timetables (Excel format)
- Teacher notifications for new class assignments

### Online Examination System
- Question bank organized by subject
- Multiple question types (MCQ, True/False, Short Answer)
- Proctoring features (webcam, tab-switch detection)
- Auto-grading for objective questions
- Time extensions for individual students
- Detailed exam analytics and reports

### Attendance Tracking
- Daily attendance recording
- Multiple status options (Present, Absent, Late, Excused)
- Historical attendance reports

### Grade Management
- Configurable grade scales per school
- Weighted exam types
- Term-based grading
- Report card generation

### Fee Management
- Fee structure definitions
- Invoice generation
- Payment tracking (Stripe integration)
- Payment history

### Communication
- In-app messaging system
- Announcement broadcasts
- Notification center
- Real-time updates

---

## Module Documentation

### Admin Modules

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/admin` | Overview with stats and recent activities |
| Students | `/admin/students` | Manage student records, assign classes |
| Teachers | `/admin/teachers` | Manage teaching staff |
| Classes | `/admin/classes` | Create and manage classes |
| Subjects | `/admin/subjects` | Define school subjects |
| Timetable | `/admin/timetable` | Create class schedules |
| Attendance | `/admin/attendance` | View attendance records |
| Exam Types | `/admin/exam-types` | Configure exam categories |
| Grade Scales | `/admin/grade-scales` | Define grading criteria |
| Fee Structures | `/admin/fee-structures` | Set up fee categories |
| Fees | `/admin/fees` | Manage invoices and payments |
| Reports | `/admin/reports` | View analytics and reports |
| Report Cards | `/admin/report-cards` | Generate student report cards |
| Announcements | `/admin/announcements` | Publish school announcements |
| Parent-Student Link | `/admin/parent-student-link` | Link parents to students |
| Teacher-Class Link | `/admin/teacher-class-link` | Assign teachers to classes/subjects |
| School Settings | `/admin/school-settings` | Configure school details |

### Teacher Modules

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/teacher` | Overview of classes and tasks |
| Classes | `/teacher/classes` | View assigned classes |
| Attendance | `/teacher/attendance` | Record daily attendance |
| Assignments | `/teacher/assignments` | Create and manage assignments |
| Grades | `/teacher/grades` | Enter student grades |
| Gradebook | `/teacher/gradebook` | Comprehensive grade management |
| Question Bank | `/teacher/question-bank` | Create exam questions (by subject) |
| Online Exams | `/teacher/online-exams` | Create and monitor online exams |
| Exams | `/teacher/exams` | Manage traditional exams |
| Resources | `/teacher/resources` | Upload learning materials |
| Timetable | `/teacher/timetable` | View teaching schedule |

### Student Modules

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/student` | Overview and announcements |
| Timetable | `/student/timetable` | View class schedule (downloadable) |
| Assignments | `/student/assignments` | View and submit assignments |
| Grades | `/student/grades` | View academic performance |
| Online Exams | `/student/online-exams` | Take online examinations |
| Resources | `/student/resources` | Access learning materials |

### Parent Modules

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/parent` | Overview of children's status |
| Children | `/parent/children` | View linked children |
| Attendance | `/parent/attendance` | Monitor attendance |
| Grades | `/parent/grades` | View academic reports |
| Payments | `/parent/payments` | Make fee payments |

---

## Connecting to External Supabase Backend

Follow these steps to connect the application to your own Supabase project:

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in project details:
   - **Name**: Your project name
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users
4. Wait for project to be created (1-2 minutes)

### Step 2: Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### Step 3: Update Environment Variables

Create or update the `.env` file in your project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Step 4: Run Database Migrations

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref your-project-id
```

4. Run migrations:
```bash
supabase db push
```

Alternatively, run the SQL migrations manually:

1. Go to Supabase Dashboard → **SQL Editor**
2. Execute each migration file from `supabase/migrations/` in order

### Step 5: Configure Authentication

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Go to **Authentication** → **Settings**
4. Configure:
   - **Confirm email**: Disable for testing (enable for production)
   - **Site URL**: Your frontend URL (e.g., `http://localhost:5173`)

### Step 6: Set Up Edge Functions

1. Deploy edge functions:
```bash
supabase functions deploy create-user-account
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy send-contact-email
```

2. Set edge function secrets:
```bash
supabase secrets set STRIPE_SECRET_KEY=your-stripe-secret-key
supabase secrets set RESEND_API_KEY=your-resend-api-key
```

### Step 7: Configure Storage (Optional)

1. Go to Supabase Dashboard → **Storage**
2. Create buckets:
   - `resources` - For learning materials
   - `avatars` - For profile pictures
   - `submissions` - For assignment submissions

3. Set up RLS policies for each bucket

### Step 8: Verify Connection

1. Start your development server:
```bash
npm run dev
```

2. Try to sign up with a new account
3. Check Supabase Dashboard → **Authentication** → **Users** to verify

### Troubleshooting

**"Invalid API key" error:**
- Verify your `.env` file has correct values
- Ensure no extra spaces or quotes in values
- Restart the development server after changes

**"Row Level Security" errors:**
- Check that all RLS policies are created
- Verify user roles are correctly assigned

**Edge functions not working:**
- Ensure functions are deployed
- Check function logs in Supabase Dashboard
- Verify all secrets are set

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profile information |
| `user_roles` | User role assignments |
| `schools` | School information |
| `classes` | Class definitions |
| `subjects` | Subject definitions |
| `students` | Student records |
| `teachers` | Teacher records |
| `parents` | Parent records |
| `enrollments` | Student-class enrollments |
| `class_subjects` | Teacher-class-subject assignments |

### Academic Tables

| Table | Description |
|-------|-------------|
| `schedules` | Timetable entries |
| `assignments` | Assignment definitions |
| `submissions` | Student submissions |
| `attendance` | Daily attendance records |
| `exams` | Traditional exam definitions |
| `exam_results` | Exam scores |
| `grades` | Student grades |
| `grade_scales` | Grading criteria |
| `exam_types` | Exam categories |

### Online Exam Tables

| Table | Description |
|-------|-------------|
| `question_bank` | Exam questions |
| `online_exams` | Online exam definitions |
| `online_exam_questions` | Exam-question mapping |
| `online_exam_attempts` | Student exam attempts |
| `online_exam_answers` | Student answers |
| `exam_proctoring_logs` | Proctoring violations |
| `exam_time_extensions` | Time accommodations |
| `exam_summary_reports` | Exam analytics |

### Financial Tables

| Table | Description |
|-------|-------------|
| `fee_structures` | Fee definitions |
| `invoices` | Student invoices |
| `payments` | Payment records |

### Communication Tables

| Table | Description |
|-------|-------------|
| `messages` | Direct messages |
| `notifications` | User notifications |
| `announcements` | School announcements |
| `resources` | Learning materials |

---

## Security Considerations

### Row-Level Security (RLS)
- All tables have RLS enabled
- Data is isolated by school_id
- Users can only access their own school's data

### Authentication
- Passwords are hashed by Supabase Auth
- JWT tokens for session management
- School code verification prevents unauthorized access

### Best Practices
1. Always use HTTPS in production
2. Enable email confirmation for production
3. Use strong admin keys
4. Regularly rotate API keys
5. Monitor authentication logs
6. Keep dependencies updated

---

## Support

For issues or questions:
1. Check the [Supabase Documentation](https://supabase.com/docs)
2. Review the codebase for implementation details
3. Check browser console for error messages
4. Review Supabase Dashboard logs

---

*Last Updated: January 2025*
