import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterAdminDto {
  // School Information
  @ApiProperty({ example: 'Horizon International Academy', description: 'Name of the new educational institution' })
  @IsString()
  @IsNotEmpty()
  schoolName: string;

  @ApiProperty({ example: 'HORIZON', description: 'Unique school short code (used for student IDs)' })
  @IsString()
  @IsNotEmpty()
  schoolCode: string;

  @ApiPropertyOptional({ example: '+233201234567', description: 'School contact telephone' })
  @IsString()
  @IsOptional()
  schoolPhone?: string;

  @ApiPropertyOptional({ example: 'GHS', description: 'School currency', default: 'GHS' })
  @IsString()
  @IsOptional()
  currency?: string;

  // Administrator Account
  @ApiProperty({ example: 'Dr. Kwame Mensah', description: 'Administrator full legal name' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'admin@horizon.edu', description: 'Administrator email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SuperSecurePass123!', description: 'Administrator password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Admin password must be at least 8 characters' })
  password: string;

  @ApiPropertyOptional({ example: '+233501234567', description: 'Admin personal phone' })
  @IsString()
  @IsOptional()
  phone?: string;
}
