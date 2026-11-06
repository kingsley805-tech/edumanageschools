import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class AssignSubjectDto {
  @ApiProperty({ description: 'Target subject ID' })
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @ApiPropertyOptional({ description: 'Teacher ID assigned to teach this subject in this class' })
  @IsUUID()
  @IsOptional()
  teacherId?: string;

  @ApiPropertyOptional({ example: 4, default: 3, description: 'Periods per week allocated' })
  @IsInt()
  @Min(1)
  @IsOptional()
  periodsPerWeek?: number;
}
