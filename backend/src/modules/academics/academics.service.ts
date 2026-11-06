import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { AssignSubjectDto } from './dto/assign-subject.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { UpsertReportCardDto } from './dto/upsert-report-card.dto';

@Injectable()
export class AcademicsService {
  constructor(private prisma: PrismaService) {}

  async getClasses(schoolId: string) {
    return this.prisma.class.findMany({
      where: { schoolId },
      include: {
        classTeacher: {
          include: { profile: true },
        },
        academicYear: true,
        _count: {
          select: {
            students: true,
            classSubjects: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getClassById(schoolId: string, classId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      include: {
        classTeacher: {
          include: { profile: true },
        },
        academicYear: true,
        classSubjects: {
          include: {
            subject: true,
            teacher: { include: { profile: true } },
          },
        },
        students: {
          include: {
            profile: true,
            parent: { include: { profile: true } },
          },
        },
      },
    });

    if (!cls) {
      throw new NotFoundException('Class not found in this school');
    }

    return cls;
  }

  async createClass(schoolId: string, dto: CreateClassDto) {
    return this.prisma.class.create({
      data: {
        schoolId,
        name: dto.name,
        stage: dto.stage,
        level: dto.level,
        stream: dto.stream,
        capacity: dto.capacity || 40,
        classTeacherId: dto.classTeacherId,
        academicYearId: dto.academicYearId,
      },
      include: {
        classTeacher: { include: { profile: true } },
      },
    });
  }

  async getSubjects(schoolId: string) {
    return this.prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }

  async createSubject(schoolId: string, dto: CreateSubjectDto) {
    const existing = await this.prisma.subject.findFirst({
      where: { schoolId, code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Subject code ${dto.code} already exists in this school`);
    }

    return this.prisma.subject.create({
      data: {
        schoolId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        department: dto.department,
        description: dto.description,
        isCore: dto.isCore ?? true,
      },
    });
  }

  async assignSubjectToClass(schoolId: string, classId: string, dto: AssignSubjectDto) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!cls) {
      throw new NotFoundException('Class not found');
    }

    return this.prisma.classSubject.upsert({
      where: {
        classId_subjectId: {
          classId,
          subjectId: dto.subjectId,
        },
      },
      update: {
        teacherId: dto.teacherId,
        periodsPerWeek: dto.periodsPerWeek ?? 3,
      },
      create: {
        classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        periodsPerWeek: dto.periodsPerWeek ?? 3,
      },
      include: {
        subject: true,
        teacher: { include: { profile: true } },
      },
    });
  }

  async recordAttendance(schoolId: string, recordedBy: string, dto: RecordAttendanceDto) {
    const dateObj = new Date(dto.date);

    // Calculate totals
    const totalPresent = dto.records.filter((r) => r.status === 'present').length;
    const totalAbsent = dto.records.filter((r) => r.status === 'absent').length;
    const totalLate = dto.records.filter((r) => r.status === 'late').length;

    return this.prisma.$transaction(async (tx) => {
      // Upsert class register
      const register = await tx.classRegister.upsert({
        where: {
          schoolId_classId_date: {
            schoolId,
            classId: dto.classId,
            date: dateObj,
          },
        },
        update: {
          totalPresent,
          totalAbsent,
          totalLate,
          recordedBy,
        },
        create: {
          schoolId,
          classId: dto.classId,
          academicYearId: dto.academicYearId,
          date: dateObj,
          totalPresent,
          totalAbsent,
          totalLate,
          recordedBy,
        },
      });

      // Upsert each student attendance record
      for (const record of dto.records) {
        await tx.attendanceRecord.upsert({
          where: {
            registerId_studentId: {
              registerId: register.id,
              studentId: record.studentId,
            },
          },
          update: {
            status: record.status,
            timeIn: record.timeIn,
            remarks: record.remarks,
          },
          create: {
            registerId: register.id,
            studentId: record.studentId,
            status: record.status,
            timeIn: record.timeIn,
            remarks: record.remarks,
          },
        });
      }

      return {
        register,
        recordsSaved: dto.records.length,
      };
    });
  }

  async getClassAttendance(schoolId: string, classId: string, date?: string) {
    const whereClause: any = { schoolId, classId };
    if (date) {
      whereClause.date = new Date(date);
    }

    return this.prisma.classRegister.findMany({
      where: whereClause,
      include: {
        records: {
          include: {
            student: { include: { profile: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 30,
    });
  }

  async upsertReportCard(schoolId: string, dto: UpsertReportCardDto) {
    return this.prisma.termReportCard.upsert({
      where: {
        academicYearId_studentId: {
          academicYearId: dto.academicYearId,
          studentId: dto.studentId,
        },
      },
      update: {
        classId: dto.classId,
        totalScore: dto.totalScore,
        averageScore: dto.averageScore,
        position: dto.position,
        classSize: dto.classSize,
        attendanceCount: dto.attendanceCount,
        conduct: dto.conduct,
        teacherRemarks: dto.teacherRemarks,
        principalRemarks: dto.principalRemarks,
        isPublished: dto.isPublished ?? false,
      },
      create: {
        schoolId,
        academicYearId: dto.academicYearId,
        studentId: dto.studentId,
        classId: dto.classId,
        totalScore: dto.totalScore,
        averageScore: dto.averageScore,
        position: dto.position,
        classSize: dto.classSize,
        attendanceCount: dto.attendanceCount,
        conduct: dto.conduct,
        teacherRemarks: dto.teacherRemarks,
        principalRemarks: dto.principalRemarks,
        isPublished: dto.isPublished ?? false,
      },
      include: {
        student: { include: { profile: true } },
        class: true,
      },
    });
  }

  async getReportCards(
    schoolId: string,
    academicYearId: string,
    classId?: string,
    studentId?: string,
  ) {
    const where: any = { schoolId, academicYearId };
    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;

    return this.prisma.termReportCard.findMany({
      where,
      include: {
        student: { include: { profile: true } },
        class: true,
        academicYear: true,
      },
      orderBy: [{ position: 'asc' }, { averageScore: 'desc' }],
    });
  }
}
