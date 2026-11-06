import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class StudentAttendanceItemDto {
  @ApiProperty({ description: 'Student ID' })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ enum: AttendanceStatus, default: AttendanceStatus.present })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional({ example: '08:15', description: 'Arrival time if late' })
  @IsString()
  @IsOptional()
  timeIn?: string;

  @ApiPropertyOptional({ example: 'Excused for medical appointment', description: 'Teacher remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class RecordAttendanceDto {
  @ApiProperty({ description: 'Class ID' })
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @ApiProperty({ description: 'Academic Year ID' })
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @ApiProperty({ example: '2026-10-28', description: 'Register date (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ type: [StudentAttendanceItemDto], description: 'List of student statuses' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentAttendanceItemDto)
  records: StudentAttendanceItemDto[];
}
