import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AcademicsService } from './academics.service';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { AssignSubjectDto } from './dto/assign-subject.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { UpsertReportCardDto } from './dto/upsert-report-card.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentSchool } from '../../common/decorators/current-school.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Academics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('academics')
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Get('classes')
  @ApiOperation({ summary: 'Retrieve list of all classes in the current school' })
  async getClasses(@CurrentSchool() schoolId: string) {
    return this.academicsService.getClasses(schoolId);
  }

  @Post('classes')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create a new class' })
  @ApiResponse({ status: 201, description: 'Class successfully created' })
  async createClass(
    @CurrentSchool() schoolId: string,
    @Body() dto: CreateClassDto,
  ) {
    return this.academicsService.createClass(schoolId, dto);
  }

  @Get('classes/:id')
  @ApiOperation({ summary: 'Retrieve class details, assigned subjects, and enrolled students' })
  async getClassById(
    @CurrentSchool() schoolId: string,
    @Param('id') classId: string,
  ) {
    return this.academicsService.getClassById(schoolId, classId);
  }

  @Get('subjects')
  @ApiOperation({ summary: 'Retrieve all subjects available in the school' })
  async getSubjects(@CurrentSchool() schoolId: string) {
    return this.academicsService.getSubjects(schoolId);
  }

  @Post('subjects')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create a new subject curriculum record' })
  async createSubject(
    @CurrentSchool() schoolId: string,
    @Body() dto: CreateSubjectDto,
  ) {
    return this.academicsService.createSubject(schoolId, dto);
  }

  @Post('classes/:classId/subjects')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Assign a subject and designated teacher to a class' })
  async assignSubject(
    @CurrentSchool() schoolId: string,
    @Param('classId') classId: string,
    @Body() dto: AssignSubjectDto,
  ) {
    return this.academicsService.assignSubjectToClass(schoolId, classId, dto);
  }

  @Post('attendance')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Record daily class attendance register entries' })
  async recordAttendance(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RecordAttendanceDto,
  ) {
    return this.academicsService.recordAttendance(schoolId, userId, dto);
  }

  @Get('attendance/class/:classId')
  @ApiOperation({ summary: 'Get class attendance register logs' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by specific date YYYY-MM-DD' })
  async getClassAttendance(
    @CurrentSchool() schoolId: string,
    @Param('classId') classId: string,
    @Query('date') date?: string,
  ) {
    return this.academicsService.getClassAttendance(schoolId, classId, date);
  }

  @Post('report-cards')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Upsert student term report card summary & evaluation remarks' })
  async upsertReportCard(
    @CurrentSchool() schoolId: string,
    @Body() dto: UpsertReportCardDto,
  ) {
    return this.academicsService.upsertReportCard(schoolId, dto);
  }

  @Get('report-cards')
  @ApiOperation({ summary: 'Query term report cards' })
  @ApiQuery({ name: 'academicYearId', required: true })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  async getReportCards(
    @CurrentSchool() schoolId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.academicsService.getReportCards(schoolId, academicYearId, classId, studentId);
  }
}
