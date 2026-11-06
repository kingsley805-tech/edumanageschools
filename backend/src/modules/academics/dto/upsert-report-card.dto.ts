import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpsertReportCardDto {
  @ApiProperty({ description: 'Academic Year ID' })
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @ApiProperty({ description: 'Student ID' })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ description: 'Class ID' })
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @ApiProperty({ example: 685.5, description: 'Aggregate total score across all subjects' })
  @IsNumber()
  totalScore: number;

  @ApiProperty({ example: 85.6, description: 'Average score percentage' })
  @IsNumber()
  averageScore: number;

  @ApiPropertyOptional({ example: 2, description: 'Class position / rank' })
  @IsNumber()
  @IsOptional()
  position?: number;

  @ApiPropertyOptional({ example: 45, description: 'Total students in class' })
  @IsNumber()
  @IsOptional()
  classSize?: number;

  @ApiPropertyOptional({ example: 58, description: 'Days present in term' })
  @IsNumber()
  @IsOptional()
  attendanceCount?: number;

  @ApiPropertyOptional({ example: 'Satisfactory and well-behaved' })
  @IsString()
  @IsOptional()
  conduct?: string;

  @ApiPropertyOptional({ example: 'Excellent performance throughout the academic term' })
  @IsString()
  @IsOptional()
  teacherRemarks?: string;

  @ApiPropertyOptional({ example: 'Promoted with distinction' })
  @IsString()
  @IsOptional()
  principalRemarks?: string;

  @ApiPropertyOptional({ default: false, description: 'Publish to parents and students' })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
