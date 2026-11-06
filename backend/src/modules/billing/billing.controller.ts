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
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InitializeCheckoutDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentSchool } from '../../common/decorators/current-school.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InvoiceStatus } from '@prisma/client';

@ApiTags('Billing & Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'Retrieve list of school invoices with optional filters' })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'status', enum: InvoiceStatus, required: false })
  async getInvoices(
    @CurrentSchool() schoolId: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.billingService.getInvoices(schoolId, studentId, status);
  }

  @Post('invoices')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Generate new student fee invoice with line items' })
  @ApiResponse({ status: 201, description: 'Invoice successfully generated' })
  async createInvoice(
    @CurrentSchool() schoolId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.billingService.createInvoice(schoolId, dto);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Retrieve specific invoice details, line items, and payment receipts' })
  async getInvoiceById(
    @CurrentSchool() schoolId: string,
    @Param('id') invoiceId: string,
  ) {
    return this.billingService.getInvoiceById(schoolId, invoiceId);
  }

  @Post('payments')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Record payment receipt against an outstanding invoice (Cash, POS, Bank)' })
  @ApiResponse({ status: 201, description: 'Payment recorded and invoice balance updated' })
  async recordPayment(
    @CurrentSchool() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billingService.recordPayment(schoolId, userId, dto);
  }

  @Get('stats')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get overview financial analytics (total invoiced, collected, outstanding balance)' })
  async getBillingStats(@CurrentSchool() schoolId: string) {
    return this.billingService.getBillingStats(schoolId);
  }

  @Post('checkout/paystack')
  @ApiOperation({ summary: 'Initialize Paystack payment gateway checkout session for invoice' })
  async initializePaystack(
    @CurrentSchool() schoolId: string,
    @Body() dto: InitializeCheckoutDto,
  ) {
    return this.billingService.initializePaystackCheckout(schoolId, dto);
  }
}
