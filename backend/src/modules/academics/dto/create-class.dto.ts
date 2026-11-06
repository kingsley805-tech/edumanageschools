import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateClassDto {
  @ApiProperty({ example: 'Basic 7A', description: 'Name of the class' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'JHS', description: 'School stage/division' })
  @IsString()
  @IsOptional()
  stage?: string;

  @ApiPropertyOptional({ example: 7, description: 'Grade level integer' })
  @IsInt()
  @IsOptional()
  level?: number;

  @ApiPropertyOptional({ example: 'A', description: 'Section or stream identifier' })
  @IsString()
  @IsOptional()
  stream?: string;

  @ApiPropertyOptional({ example: 45, description: 'Maximum student capacity', default: 40 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ description: 'Teacher ID assigned as class master/teacher' })
  @IsUUID()
  @IsOptional()
  classTeacherId?: string;

  @ApiPropertyOptional({ description: 'Academic Year ID' })
  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}
