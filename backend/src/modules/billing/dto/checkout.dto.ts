import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class InitializeCheckoutDto {
  @ApiProperty({ description: 'Invoice ID' })
  @IsUUID()
  @IsNotEmpty()
  invoiceId: string;

  @ApiProperty({ example: 450.0, description: 'Amount to charge' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'payer@example.com', description: 'Customer or Parent email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'http://localhost:5173/payment/callback' })
  @IsString()
  @IsOptional()
  callbackUrl?: string;
}
