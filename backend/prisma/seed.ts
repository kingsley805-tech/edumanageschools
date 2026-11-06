import { PrismaClient, AppRole, Gender, AttendanceStatus, InvoiceStatus, PaymentMethod, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for two dummy schools...');

  // Common default password for test logins: "Password123!"
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('Password123!', saltRounds);

  // List of seed user emails for clean cleanup & idempotency
  const seedEmails = [
    // Platform Super Admin
    'superadmin@edumanage.com',

    // School 1 (St. Augustine Academy)
    'admin@staugustine.edu',
    'kwame.asante@staugustine.edu',
    'grace.boateng@staugustine.edu',
    'kofi.owusu@staugustine.edu',
    'ama.serwaa@staugustine.edu',
    'kwabena.owusu@gmail.com',

    // School 2 (Ridgefield International School)
    'admin@ridgefield.edu',
    'david.appiah@ridgefield.edu',
    'sarah.addison@ridgefield.edu',
    'michael.osei@ridgefield.edu',
    'abena.mensah@ridgefield.edu',
    'samuel.mensah@gmail.com',
  ];

  console.log('🧹 Cleaning up any previous seed data...');
  // Delete users by seed email (this cascades to profiles and roles)
  await prisma.user.deleteMany({
    where: { email: { in: seedEmails } },
  });

  // Delete previous schools by code (this cascades to all school-related models)
  await prisma.school.deleteMany({
    where: { code: { in: ['SAA', 'RIS'] } },
  });

  // =========================================================================
  // 1. SUBSCRIPTION PACKAGES
  // =========================================================================
  console.log('📦 Seeding subscription packages...');
  const enterprisePackage = await prisma.subscriptionPackage.upsert({
    where: { code: 'ENTERPRISE' },
    update: {},
    create: {
      name: 'Enterprise School Suite',
      code: 'ENTERPRISE',
      price: 2500.0,
      currency: 'GHS',
      billingCycle: 'termly',
      maxStudents: 1500,
      maxTeachers: 100,
      features: [
        'unlimited_students',
        'sms_notifications',
        'paystack_integration',
        'exam_report_cards',
        'pos_receipts',
      ],
    },
  });

  const standardPackage = await prisma.subscriptionPackage.upsert({
    where: { code: 'STANDARD' },
    update: {},
    create: {
      name: 'Standard Pro',
      code: 'STANDARD',
      price: 1200.0,
      currency: 'USD',
      billingCycle: 'termly',
      maxStudents: 500,
      maxTeachers: 40,
      features: [
        'class_attendance',
        'gradebook',
        'fee_management',
        'parent_portal',
      ],
    },
  });

  // =========================================================================
  // 2. SCHOOL 1: ST. AUGUSTINE ACADEMY (Local Curriculum / GHS)
  // =========================================================================
  console.log('🏫 Seeding School 1: St. Augustine Academy (SAA)...');

  const school1 = await prisma.school.create({
    data: {
      name: 'St. Augustine Academy',
      code: 'SAA',
      slug: 'st-augustine',
      address: '12 Independence Avenue, Ridge, Accra, Ghana',
      phone: '+233 24 100 0001',
      email: 'info@staugustine.edu',
      primaryColor: '#1E40AF',
      secondaryColor: '#F59E0B',
      motto: 'Excellence in Faith, Character and Knowledge',
      currency: 'GHS',
      isActive: true,
      subscriptions: {
        create: {
          packageId: enterprisePackage.id,
          status: SubscriptionStatus.active,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2026-01-01'),
          autoRenew: true,
        },
      },
    },
  });

  // Academic Year
  const academicYear1 = await prisma.academicYear.create({
    data: {
      schoolId: school1.id,
      name: '2025/2026',
      term: 'Term 1',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-19'),
      isCurrent: true,
    },
  });

  // Admin User
  const adminUser1 = await prisma.user.create({
    data: {
      email: 'admin@staugustine.edu',
      passwordHash,
      phone: '+233241000001',
      isVerified: true,
      profile: {
        create: {
          schoolId: school1.id,
          fullName: 'Rev. Emmanuel Mensah',
          firstName: 'Emmanuel',
          lastName: 'Mensah',
          metadata: { title: 'Headmaster' },
        },
      },
      userRoles: {
        create: {
          schoolId: school1.id,
          role: AppRole.admin,
        },
      },
    },
    include: { profile: true },
  });

  // Teachers
  const teacherUser1 = await prisma.user.create({
    data: {
      email: 'kwame.asante@staugustine.edu',
      passwordHash,
      phone: '+233241000010',
      isVerified: true,
      profile: {
        create: {
          schoolId: school1.id,
          fullName: 'Kwame Asante',
          firstName: 'Kwame',
          lastName: 'Asante',
        },
      },
      userRoles: {
        create: {
          schoolId: school1.id,
          role: AppRole.teacher,
        },
      },
    },
    include: { profile: true },
  });

  const teacher1 = await prisma.teacher.create({
    data: {
      schoolId: school1.id,
      profileId: teacherUser1.profile!.id,
      employeeId: 'TCH-SAA-001',
      qualification: 'B.Sc. Mathematics & Science Education',
      specialization: 'Mathematics, Science',
    },
  });

  const teacherUser2 = await prisma.user.create({
    data: {
      email: 'grace.boateng@staugustine.edu',
      passwordHash,
      phone: '+233241000011',
      isVerified: true,
      profile: {
        create: {
          schoolId: school1.id,
          fullName: 'Grace Boateng',
          firstName: 'Grace',
          lastName: 'Boateng',
        },
      },
      userRoles: {
        create: {
          schoolId: school1.id,
          role: AppRole.teacher,
        },
      },
    },
    include: { profile: true },
  });

  const teacher2 = await prisma.teacher.create({
    data: {
      schoolId: school1.id,
      profileId: teacherUser2.profile!.id,
      employeeId: 'TCH-SAA-002',
      qualification: 'B.A. English & Linguistics',
      specialization: 'English Language',
    },
  });

  // Classes
  const class7A = await prisma.class.create({
    data: {
      schoolId: school1.id,
      academicYearId: academicYear1.id,
      name: 'Basic 7 Alpha',
      stage: 'JHS',
      level: 7,
      stream: 'Alpha',
      capacity: 35,
      classTeacherId: teacher1.id,
    },
  });

  const class8A = await prisma.class.create({
    data: {
      schoolId: school1.id,
      academicYearId: academicYear1.id,
      name: 'Basic 8 Alpha',
      stage: 'JHS',
      level: 8,
      stream: 'Alpha',
      capacity: 35,
      classTeacherId: teacher2.id,
    },
  });

  // Subjects
  const subjectMath1 = await prisma.subject.create({
    data: {
      schoolId: school1.id,
      name: 'Mathematics',
      code: 'MATH-JHS',
      department: 'Mathematics & Computing',
      isCore: true,
    },
  });

  const subjectEng1 = await prisma.subject.create({
    data: {
      schoolId: school1.id,
      name: 'English Language',
      code: 'ENG-JHS',
      department: 'Languages',
      isCore: true,
    },
  });

  const subjectSci1 = await prisma.subject.create({
    data: {
      schoolId: school1.id,
      name: 'Integrated Science',
      code: 'SCI-JHS',
      department: 'Sciences',
      isCore: true,
    },
  });

  // Assign Subjects to Class 7A
  await prisma.classSubject.createMany({
    data: [
      { classId: class7A.id, subjectId: subjectMath1.id, teacherId: teacher1.id, periodsPerWeek: 5 },
      { classId: class7A.id, subjectId: subjectSci1.id, teacherId: teacher1.id, periodsPerWeek: 4 },
      { classId: class7A.id, subjectId: subjectEng1.id, teacherId: teacher2.id, periodsPerWeek: 5 },
    ],
  });

  // Parent
  const parentUser1 = await prisma.user.create({
    data: {
      email: 'kwabena.owusu@gmail.com',
      passwordHash,
      phone: '+233241000030',
      isVerified: true,
      profile: {
        create: {
          schoolId: school1.id,
          fullName: 'Kwabena Owusu',
          firstName: 'Kwabena',
          lastName: 'Owusu',
        },
      },
      userRoles: {
        create: {
          schoolId: school1.id,
          role: AppRole.parent,
        },
      },
    },
    include: { profile: true },
  });

  const parent1 = await prisma.parent.create({
    data: {
      schoolId: school1.id,
      profileId: parentUser1.profile!.id,
      occupation: 'Civil Engineer',
      emergencyContact: '+233 24 100 0030',
      relationship: 'Father',
    },
  });

  // Students
  const studentUser1 = await prisma.user.create({
    data: {
      email: 'kofi.owusu@staugustine.edu',
      passwordHash,
      phone: '+233241000020',
      isVerified: true,
      profile: {
        create: {
          schoolId: school1.id,
          fullName: 'Kofi Owusu',
          firstName: 'Kofi',
          lastName: 'Owusu',
        },
      },
      userRoles: {
        create: {
          schoolId: school1.id,
          role: AppRole.student,
        },
      },
    },
    include: { profile: true },
  });

  const student1 = await prisma.student.create({
    data: {
      schoolId: school1.id,
      profileId: studentUser1.profile!.id,
      registrationNumber: 'STU-SAA-2025-001',
      classId: class7A.id,
      parentId: parent1.id,
      dateOfBirth: new Date('2012-05-14'),
      gender: Gender.male,
    },
  });

  const studentUser2 = await prisma.user.create({
    data: {
      email: 'ama.serwaa@staugustine.edu',
      passwordHash,
      phone: '+233241000021',
      isVerified: true,
      profile: {
        create: {
          schoolId: school1.id,
          fullName: 'Ama Serwaa',
          firstName: 'Ama',
          lastName: 'Serwaa',
        },
      },
      userRoles: {
        create: {
          schoolId: school1.id,
          role: AppRole.student,
        },
      },
    },
    include: { profile: true },
  });

  const student2 = await prisma.student.create({
    data: {
      schoolId: school1.id,
      profileId: studentUser2.profile!.id,
      registrationNumber: 'STU-SAA-2025-002',
      classId: class7A.id,
      dateOfBirth: new Date('2012-08-22'),
      gender: Gender.female,
    },
  });

  // Attendance Register for Class 7A
  const registerDate = new Date();
  registerDate.setHours(0, 0, 0, 0);

  const register1 = await prisma.classRegister.create({
    data: {
      schoolId: school1.id,
      classId: class7A.id,
      academicYearId: academicYear1.id,
      date: registerDate,
      totalPresent: 2,
      totalAbsent: 0,
      totalLate: 0,
      recordedBy: teacher1.id,
      records: {
        create: [
          { studentId: student1.id, status: AttendanceStatus.present, timeIn: '07:45 AM' },
          { studentId: student2.id, status: AttendanceStatus.present, timeIn: '07:50 AM' },
        ],
      },
    },
  });

  // Fee Categories & Fee Structure
  const feeTuition1 = await prisma.feeCategory.create({
    data: {
      schoolId: school1.id,
      name: 'Tuition Fee',
      description: 'Termly academic tuition fee',
      isCompulsory: true,
    },
  });

  const feePta1 = await prisma.feeCategory.create({
    data: {
      schoolId: school1.id,
      name: 'PTA Levy',
      description: 'Parent-Teacher Association development levy',
      isCompulsory: true,
    },
  });

  await prisma.feeStructure.createMany({
    data: [
      {
        schoolId: school1.id,
        academicYearId: academicYear1.id,
        classId: class7A.id,
        feeCategoryId: feeTuition1.id,
        amount: 1500.0,
      },
      {
        schoolId: school1.id,
        academicYearId: academicYear1.id,
        classId: class7A.id,
        feeCategoryId: feePta1.id,
        amount: 200.0,
      },
    ],
  });

  // Billing Invoice & Payment for Student 1
  const invoice1 = await prisma.billingInvoice.create({
    data: {
      schoolId: school1.id,
      studentId: student1.id,
      academicYearId: academicYear1.id,
      invoiceNumber: 'INV-SAA-2025-001',
      subtotal: 1700.0,
      discount: 0.0,
      totalAmount: 1700.0,
      amountPaid: 1000.0,
      balanceDue: 700.0,
      status: InvoiceStatus.partially_paid,
      dueDate: new Date('2025-10-15'),
      lineItems: {
        create: [
          { feeCategoryId: feeTuition1.id, description: 'Term 1 Tuition Fee', unitAmount: 1500.0, quantity: 1, totalAmount: 1500.0 },
          { feeCategoryId: feePta1.id, description: 'Term 1 PTA Levy', unitAmount: 200.0, quantity: 1, totalAmount: 200.0 },
        ],
      },
      payments: {
        create: {
          schoolId: school1.id,
          studentId: student1.id,
          receiptNumber: 'REC-SAA-2025-001',
          amount: 1000.0,
          paymentMethod: PaymentMethod.mobile_money,
          reference: 'MM-TX-984321',
          notes: 'Deposit paid via MTN Mobile Money',
        },
      },
    },
  });

  // School Announcement
  await prisma.announcement.create({
    data: {
      schoolId: school1.id,
      title: 'Welcome to Academic Year 2025/2026',
      content: 'We warmly welcome all returning students and new parents to St. Augustine Academy. Classes commence promptly at 8:00 AM.',
      targetAudience: 'all',
      priority: 'high',
    },
  });

  // =========================================================================
  // 3. SCHOOL 2: RIDGEFIELD INTERNATIONAL SCHOOL (Cambridge / USD)
  // =========================================================================
  console.log('🏫 Seeding School 2: Ridgefield International School (RIS)...');

  const school2 = await prisma.school.create({
    data: {
      name: 'Ridgefield International School',
      code: 'RIS',
      slug: 'ridgefield',
      address: '45 Ridge Hill Road, Airport Residential, Kumasi, Ghana',
      phone: '+233 24 200 0002',
      email: 'info@ridgefield.edu',
      primaryColor: '#047857',
      secondaryColor: '#10B981',
      motto: 'Nurturing Inquiring Minds and Global Leaders',
      currency: 'USD',
      isActive: true,
      subscriptions: {
        create: {
          packageId: standardPackage.id,
          status: SubscriptionStatus.active,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2026-01-01'),
          autoRenew: true,
        },
      },
    },
  });

  // Academic Year
  const academicYear2 = await prisma.academicYear.create({
    data: {
      schoolId: school2.id,
      name: '2025/2026',
      term: 'Semester 1',
      startDate: new Date('2025-08-15'),
      endDate: new Date('2025-12-15'),
      isCurrent: true,
    },
  });

  // Admin User
  const adminUser2 = await prisma.user.create({
    data: {
      email: 'admin@ridgefield.edu',
      passwordHash,
      phone: '+233242000001',
      isVerified: true,
      profile: {
        create: {
          schoolId: school2.id,
          fullName: 'Dr. Victoria Osei',
          firstName: 'Victoria',
          lastName: 'Osei',
          metadata: { title: 'Principal' },
        },
      },
      userRoles: {
        create: {
          schoolId: school2.id,
          role: AppRole.admin,
        },
      },
    },
    include: { profile: true },
  });

  // Teachers
  const teacherUser3 = await prisma.user.create({
    data: {
      email: 'david.appiah@ridgefield.edu',
      passwordHash,
      phone: '+233242000010',
      isVerified: true,
      profile: {
        create: {
          schoolId: school2.id,
          fullName: 'David Appiah',
          firstName: 'David',
          lastName: 'Appiah',
        },
      },
      userRoles: {
        create: {
          schoolId: school2.id,
          role: AppRole.teacher,
        },
      },
    },
    include: { profile: true },
  });

  const teacher3 = await prisma.teacher.create({
    data: {
      schoolId: school2.id,
      profileId: teacherUser3.profile!.id,
      employeeId: 'TCH-RIS-001',
      qualification: 'M.Sc. Physics (Oxon)',
      specialization: 'Physics, Applied Mechanics',
    },
  });

  const teacherUser4 = await prisma.user.create({
    data: {
      email: 'sarah.addison@ridgefield.edu',
      passwordHash,
      phone: '+233242000011',
      isVerified: true,
      profile: {
        create: {
          schoolId: school2.id,
          fullName: 'Sarah Addison',
          firstName: 'Sarah',
          lastName: 'Addison',
        },
      },
      userRoles: {
        create: {
          schoolId: school2.id,
          role: AppRole.teacher,
        },
      },
    },
    include: { profile: true },
  });

  const teacher4 = await prisma.teacher.create({
    data: {
      schoolId: school2.id,
      profileId: teacherUser4.profile!.id,
      employeeId: 'TCH-RIS-002',
      qualification: 'B.A. English Literature',
      specialization: 'IGCSE English & World Literature',
    },
  });

  // Classes
  const classGrade10 = await prisma.class.create({
    data: {
      schoolId: school2.id,
      academicYearId: academicYear2.id,
      name: 'Grade 10 Cambridge',
      stage: 'High School',
      level: 10,
      stream: 'Cambridge',
      capacity: 25,
      classTeacherId: teacher3.id,
    },
  });

  const classGrade11 = await prisma.class.create({
    data: {
      schoolId: school2.id,
      academicYearId: academicYear2.id,
      name: 'Grade 11 Cambridge',
      stage: 'High School',
      level: 11,
      stream: 'Cambridge',
      capacity: 25,
      classTeacherId: teacher4.id,
    },
  });

  // Subjects
  const subjectPhysics2 = await prisma.subject.create({
    data: {
      schoolId: school2.id,
      name: 'IGCSE Physics',
      code: 'PHYS-IGCSE',
      department: 'Sciences',
      isCore: true,
    },
  });

  const subjectLit2 = await prisma.subject.create({
    data: {
      schoolId: school2.id,
      name: 'IGCSE English Literature',
      code: 'LIT-IGCSE',
      department: 'Humanities',
      isCore: true,
    },
  });

  // Assign Subjects
  await prisma.classSubject.createMany({
    data: [
      { classId: classGrade10.id, subjectId: subjectPhysics2.id, teacherId: teacher3.id, periodsPerWeek: 4 },
      { classId: classGrade10.id, subjectId: subjectLit2.id, teacherId: teacher4.id, periodsPerWeek: 4 },
    ],
  });

  // Parent
  const parentUser2 = await prisma.user.create({
    data: {
      email: 'samuel.mensah@gmail.com',
      passwordHash,
      phone: '+233242000030',
      isVerified: true,
      profile: {
        create: {
          schoolId: school2.id,
          fullName: 'Samuel Mensah',
          firstName: 'Samuel',
          lastName: 'Mensah',
        },
      },
      userRoles: {
        create: {
          schoolId: school2.id,
          role: AppRole.parent,
        },
      },
    },
    include: { profile: true },
  });

  const parent2 = await prisma.parent.create({
    data: {
      schoolId: school2.id,
      profileId: parentUser2.profile!.id,
      occupation: 'Investment Banker',
      emergencyContact: '+233 24 200 0030',
      relationship: 'Father',
    },
  });

  // Students
  const studentUser3 = await prisma.user.create({
    data: {
      email: 'michael.osei@ridgefield.edu',
      passwordHash,
      phone: '+233242000020',
      isVerified: true,
      profile: {
        create: {
          schoolId: school2.id,
          fullName: 'Michael Osei',
          firstName: 'Michael',
          lastName: 'Osei',
        },
      },
      userRoles: {
        create: {
          schoolId: school2.id,
          role: AppRole.student,
        },
      },
    },
    include: { profile: true },
  });

  const student3 = await prisma.student.create({
    data: {
      schoolId: school2.id,
      profileId: studentUser3.profile!.id,
      registrationNumber: 'STU-RIS-2025-001',
      classId: classGrade10.id,
      dateOfBirth: new Date('2009-03-10'),
      gender: Gender.male,
    },
  });

  const studentUser4 = await prisma.user.create({
    data: {
      email: 'abena.mensah@ridgefield.edu',
      passwordHash,
      phone: '+233242000021',
      isVerified: true,
      profile: {
        create: {
          schoolId: school2.id,
          fullName: 'Abena Mensah',
          firstName: 'Abena',
          lastName: 'Mensah',
        },
      },
      userRoles: {
        create: {
          schoolId: school2.id,
          role: AppRole.student,
        },
      },
    },
    include: { profile: true },
  });

  const student4 = await prisma.student.create({
    data: {
      schoolId: school2.id,
      profileId: studentUser4.profile!.id,
      registrationNumber: 'STU-RIS-2025-002',
      classId: classGrade10.id,
      parentId: parent2.id,
      dateOfBirth: new Date('2009-07-18'),
      gender: Gender.female,
    },
  });

  // Attendance Register for Grade 10
  const register2 = await prisma.classRegister.create({
    data: {
      schoolId: school2.id,
      classId: classGrade10.id,
      academicYearId: academicYear2.id,
      date: registerDate,
      totalPresent: 2,
      totalAbsent: 0,
      totalLate: 0,
      recordedBy: teacher3.id,
      records: {
        create: [
          { studentId: student3.id, status: AttendanceStatus.present, timeIn: '08:00 AM' },
          { studentId: student4.id, status: AttendanceStatus.present, timeIn: '08:05 AM' },
        ],
      },
    },
  });

  // Fee Categories & Fee Structure
  const feeTuition2 = await prisma.feeCategory.create({
    data: {
      schoolId: school2.id,
      name: 'Cambridge IGCSE Tuition',
      description: 'Termly IGCSE curriculum instruction and lab fees',
      isCompulsory: true,
    },
  });

  const feeStemLab2 = await prisma.feeCategory.create({
    data: {
      schoolId: school2.id,
      name: 'STEM & Robotics Lab',
      description: 'Lab consumables and equipment usage fee',
      isCompulsory: true,
    },
  });

  await prisma.feeStructure.createMany({
    data: [
      {
        schoolId: school2.id,
        academicYearId: academicYear2.id,
        classId: classGrade10.id,
        feeCategoryId: feeTuition2.id,
        amount: 2500.0,
      },
      {
        schoolId: school2.id,
        academicYearId: academicYear2.id,
        classId: classGrade10.id,
        feeCategoryId: feeStemLab2.id,
        amount: 350.0,
      },
    ],
  });

  // Billing Invoice & Payment for Abena Mensah
  const invoice2 = await prisma.billingInvoice.create({
    data: {
      schoolId: school2.id,
      studentId: student4.id,
      academicYearId: academicYear2.id,
      invoiceNumber: 'INV-RIS-2025-001',
      subtotal: 2850.0,
      discount: 0.0,
      totalAmount: 2850.0,
      amountPaid: 2850.0,
      balanceDue: 0.0,
      status: InvoiceStatus.paid,
      dueDate: new Date('2025-09-30'),
      lineItems: {
        create: [
          { feeCategoryId: feeTuition2.id, description: 'Semester 1 IGCSE Tuition', unitAmount: 2500.0, quantity: 1, totalAmount: 2500.0 },
          { feeCategoryId: feeStemLab2.id, description: 'STEM & Robotics Lab Consumables', unitAmount: 350.0, quantity: 1, totalAmount: 350.0 },
        ],
      },
      payments: {
        create: {
          schoolId: school2.id,
          studentId: student4.id,
          receiptNumber: 'REC-RIS-2025-001',
          amount: 2850.0,
          paymentMethod: PaymentMethod.bank_transfer,
          reference: 'SWIFT-RIS-2025-9988',
          notes: 'Full payment via wire transfer',
        },
      },
    },
  });

  // School Announcement
  await prisma.announcement.create({
    data: {
      schoolId: school2.id,
      title: 'Cambridge IGCSE Orientation Week',
      content: 'Welcome to Grade 10 & 11 Cambridge students! Lab safety orientation will take place on Thursday.',
      targetAudience: 'all',
      priority: 'high',
    },
  });

  // =========================================================================
  // 4. PLATFORM SUPER ADMINISTRATOR (Universal Access Across All Schools)
  // =========================================================================
  console.log('👑 Seeding Global Super Admin...');
  await prisma.user.create({
    data: {
      email: 'superadmin@edumanage.com',
      passwordHash,
      phone: '+233200000000',
      isVerified: true,
      profile: {
        create: {
          schoolId: school1.id,
          fullName: 'System Super Administrator',
          firstName: 'System',
          lastName: 'SuperAdmin',
          metadata: { title: 'Global Platform Administrator' },
        },
      },
      userRoles: {
        create: [
          { schoolId: school1.id, role: AppRole.super_admin },
          { schoolId: school2.id, role: AppRole.super_admin },
        ],
      },
    },
  });

  console.log('\n✅ Seeding completed successfully!');
  console.log('--------------------------------------------------');
  console.log('🔑 TEST ACCOUNTS (Password for all: Password123!)');
  console.log('--------------------------------------------------');
  console.log('👑 Platform Super Admin:');
  console.log('  - Email:    superadmin@edumanage.com');
  console.log('  - Password: Password123!');
  console.log('  - Role:     super_admin (Universal platform access)');
  console.log('');
  console.log(`School 1: St. Augustine Academy (Code: SAA | GHS | ID: ${school1.id})`);
  console.log('  - Admin:   admin@staugustine.edu');
  console.log('  - Teacher: kwame.asante@staugustine.edu');
  console.log('  - Teacher: grace.boateng@staugustine.edu');
  console.log('  - Student: kofi.owusu@staugustine.edu');
  console.log('  - Student: ama.serwaa@staugustine.edu');
  console.log('  - Parent:  kwabena.owusu@gmail.com');
  console.log('');
  console.log(`School 2: Ridgefield International School (Code: RIS | USD | ID: ${school2.id})`);
  console.log('  - Admin:   admin@ridgefield.edu');
  console.log('  - Teacher: david.appiah@ridgefield.edu');
  console.log('  - Teacher: sarah.addison@ridgefield.edu');
  console.log('  - Student: michael.osei@ridgefield.edu');
  console.log('  - Student: abena.mensah@ridgefield.edu');
  console.log('  - Parent:  samuel.mensah@gmail.com');
  console.log('--------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

