import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InitializeCheckoutDto } from './dto/checkout.dto';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async getInvoices(schoolId: string, studentId?: string, status?: InvoiceStatus) {
    const where: any = { schoolId };
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;

    return this.prisma.billingInvoice.findMany({
      where,
      include: {
        student: {
          include: {
            profile: true,
            class: true,
          },
        },
        academicYear: true,
        lineItems: {
          include: { feeCategory: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoiceById(schoolId: string, invoiceId: string) {
    const invoice = await this.prisma.billingInvoice.findFirst({
      where: { id: invoiceId, schoolId },
      include: {
        student: {
          include: {
            profile: true,
            class: true,
            parent: { include: { profile: true } },
          },
        },
        academicYear: true,
        lineItems: {
          include: { feeCategory: true },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async createInvoice(schoolId: string, dto: CreateInvoiceDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, schoolId },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this school');
    }

    // Calculate totals
    const subtotal = dto.lineItems.reduce(
      (sum, item) => sum + item.unitAmount * (item.quantity || 1),
      0,
    );
    const discount = dto.discount || 0;
    const totalAmount = Math.max(0, subtotal - discount);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.billingInvoice.create({
        data: {
          schoolId,
          studentId: dto.studentId,
          academicYearId: dto.academicYearId,
          invoiceNumber,
          subtotal,
          discount,
          totalAmount,
          amountPaid: 0,
          balanceDue: totalAmount,
          status: InvoiceStatus.pending,
          dueDate: new Date(dto.dueDate),
          lineItems: {
            create: dto.lineItems.map((item) => ({
              feeCategoryId: item.feeCategoryId,
              description: item.description,
              unitAmount: item.unitAmount,
              quantity: item.quantity || 1,
              totalAmount: item.unitAmount * (item.quantity || 1),
            })),
          },
        },
        include: {
          lineItems: true,
          student: { include: { profile: true } },
        },
      });

      return invoice;
    });
  }

  async recordPayment(schoolId: string, receivedBy: string, dto: RecordPaymentDto) {
    const invoice = await this.prisma.billingInvoice.findFirst({
      where: { id: dto.invoiceId, schoolId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const currentBalance = Number(invoice.balanceDue);
    if (dto.amount > currentBalance) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds outstanding balance (${currentBalance})`,
      );
    }

    const receiptNumber = `REC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Record payment receipt
      const payment = await tx.billingPayment.create({
        data: {
          schoolId,
          invoiceId: dto.invoiceId,
          studentId: dto.studentId,
          receiptNumber,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          reference: dto.reference,
          receivedBy,
          notes: dto.notes,
        },
      });

      // 2. Update invoice balance and status
      const updatedAmountPaid = Number(invoice.amountPaid) + dto.amount;
      const updatedBalanceDue = Number(invoice.totalAmount) - updatedAmountPaid;

      let newStatus: InvoiceStatus = invoice.status;
      if (updatedBalanceDue <= 0.001) {
        newStatus = InvoiceStatus.paid;
      } else if (updatedAmountPaid > 0) {
        newStatus = InvoiceStatus.partially_paid;
      }

      const updatedInvoice = await tx.billingInvoice.update({
        where: { id: dto.invoiceId },
        data: {
          amountPaid: updatedAmountPaid,
          balanceDue: updatedBalanceDue,
          status: newStatus,
        },
      });

      return {
        receipt: payment,
        invoice: updatedInvoice,
      };
    });
  }

  async getBillingStats(schoolId: string) {
    const [invoices, payments] = await Promise.all([
      this.prisma.billingInvoice.findMany({
        where: { schoolId },
        select: {
          totalAmount: true,
          amountPaid: true,
          balanceDue: true,
          status: true,
        },
      }),
      this.prisma.billingPayment.findMany({
        where: { schoolId },
        select: {
          amount: true,
          paymentMethod: true,
          paidAt: true,
        },
      }),
    ]);

    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);

    const paidInvoicesCount = invoices.filter((i) => i.status === InvoiceStatus.paid).length;
    const pendingInvoicesCount = invoices.filter((i) => i.status === InvoiceStatus.pending).length;
    const partialInvoicesCount = invoices.filter((i) => i.status === InvoiceStatus.partially_paid).length;

    return {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      collectionRate: totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) + '%' : '0%',
      counts: {
        total: invoices.length,
        paid: paidInvoicesCount,
        pending: pendingInvoicesCount,
        partiallyPaid: partialInvoicesCount,
      },
      recentPaymentsCount: payments.length,
    };
  }

  async initializePaystackCheckout(schoolId: string, dto: InitializeCheckoutDto) {
    const invoice = await this.prisma.billingInvoice.findFirst({
      where: { id: dto.invoiceId, schoolId },
      include: { school: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const reference = `PSTK-${invoice.invoiceNumber}-${Date.now()}`;

    // Here we can either invoke Paystack API or return formatted payload for frontend inline checkout
    return {
      reference,
      amount: dto.amount,
      currency: invoice.school.currency || 'GHS',
      email: dto.email,
      invoiceNumber: invoice.invoiceNumber,
      callbackUrl: dto.callbackUrl,
    };
  }
}
