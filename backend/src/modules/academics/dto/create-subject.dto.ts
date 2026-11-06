import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Integrated Science', description: 'Subject title' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'SCI101', description: 'Unique subject code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'Sciences', description: 'Department category' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ example: 'General Science curriculum covering Biology, Chemistry, Physics' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Whether subject is core compulsory' })
  @IsBoolean()
  @IsOptional()
  isCore?: boolean;
}
