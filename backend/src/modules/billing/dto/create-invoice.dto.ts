import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class InvoiceLineItemDto {
  @ApiProperty({ description: 'Fee Category ID (e.g. Tuition, Exam, PTA)' })
  @IsUUID()
  @IsNotEmpty()
  feeCategoryId: string;

  @ApiProperty({ example: 'Term 1 Tuition Fee', description: 'Item description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 1200.0, description: 'Unit cost amount' })
  @IsNumber()
  @Min(0)
  unitAmount: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Student ID for whom the invoice is billed' })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ description: 'Academic Year ID' })
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @ApiPropertyOptional({ example: 50.0, default: 0.0, description: 'Scholarship or discount amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @ApiProperty({ example: '2026-11-30', description: 'Due date for invoice settlement' })
  @IsDateString()
  @IsNotEmpty()
  dueDate: string;

  @ApiProperty({ type: [InvoiceLineItemDto], description: 'Individual billing line items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems: InvoiceLineItemDto[];
}
