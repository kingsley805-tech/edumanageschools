import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Invoice ID being settled' })
  @IsUUID()
  @IsNotEmpty()
  invoiceId: string;

  @ApiProperty({ description: 'Student ID' })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ example: 500.0, description: 'Amount paid' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.cash })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'TXN-984210', description: 'Bank transfer or POS transaction reference' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({ example: 'Paid at bursary counter', description: 'Payment receipt notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
