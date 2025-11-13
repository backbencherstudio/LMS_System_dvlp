import {
  Controller,
  Post,
  Req,
  Headers,
  UseGuards,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { StripeService } from './stripe.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';
import { CreateStripeDto } from './dto/create-stripe.dto';

@Controller('payment/stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('pay')
  @UseGuards(JwtAuthGuard)
  async pay(
    @Body() body: CreateStripeDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    const userId = req.user?.userId;
    console.log(userId), console.log(body.bookingId);
    console.log(body.sessionId);
    if (!userId) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const booking = await this.prisma.book_Session.findUnique({
      where: {
        id: body.bookingId,
        user_id: userId,
        create_session_id: body.sessionId,
      },
      include: {
        create_session: { select: { session_charge: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(
        'Booking not found or you do not have permission to pay for it.',
      );
    }

    if (booking.payment_status === 'paid') {
      throw new BadRequestException('This session has already been paid for.');
    }

    const amount = Number(booking.create_session?.session_charge);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid session charge amount.');
    }

    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        user_id: userId,
        order_id: booking.id,
        amount: amount,
        currency: body.currency || 'usd',
        status: 'pending',
        provider: 'stripe',
        type: 'session_booking',
      },
    });

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      let customerId = user.billing_id;

      if (!customerId) {
        const customer = await StripePayment.createCustomer({
          user_id: user.id,
          name: user.name || 'N/A',
          email: user.email,
        });
        customerId = customer.id;
        await this.prisma.user.update({
          where: { id: userId },
          data: { billing_id: customerId },
        });
      }

      const paymentIntent = await StripePayment.createPaymentIntent({
        amount: amount,
        currency: body.currency || 'usd',
        customer_id: customerId,
        metadata: {
          userId: userId,
          bookingId: booking.id,
          transactionId: transaction.id,
        },
      });

      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { reference_number: paymentIntent.id },
      });

      this.logger.log(`PaymentIntent created for booking: ${booking.id}`);
      return {
        clientSecret: paymentIntent.client_secret,
        message:
          'PaymentIntent created successfully. Please complete the payment.',
      };
    } catch (error) {
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'failed', raw_status: error.message },
      });
      this.logger.error(
        `Failed to create PaymentIntent for booking ${body.bookingId}:`,
        error.stack,
      );
      throw new HttpException(
        'Failed to create payment intent.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request & { rawBody: Buffer },
  ) {
    try {
      const event = await this.stripeService.handleWebhook(
        req.rawBody,
        signature,
      );
      const paymentIntent = event.data.object as any;
      const { bookingId, transactionId } = paymentIntent.metadata;

      if (!bookingId || !transactionId) {
        throw new BadRequestException(
          'Missing bookingId or transactionId in webhook metadata.',
        );
      }

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.prisma.$transaction(async (tx) => {
            await tx.book_Session.update({
              where: { id: bookingId },
              data: {
                payment_status: 'paid',
                transaction_id: transactionId,
              },
            });
            await tx.paymentTransaction.update({
              where: { id: transactionId },
              data: {
                status: 'succeeded',
                raw_status: paymentIntent.status,
                paid_amount: paymentIntent.amount_received / 100,
                paid_currency: paymentIntent.currency,
              },
            });
          });
          this.logger.log(`Payment succeeded for booking: ${bookingId}`);
          break;

        case 'payment_intent.payment_failed':
          await this.prisma.paymentTransaction.update({
            where: { id: transactionId },
            data: { status: 'failed', raw_status: paymentIntent.status },
          });
          this.logger.warn(
            `Payment failed for booking: ${bookingId}. Reason: ${paymentIntent.last_payment_error?.message}`,
          );
          break;

        default:
          this.logger.log(`Unhandled Stripe event type: ${event.type}`);
      }
      return { received: true };
    } catch (error) {
      this.logger.error('Webhook processing error:', error.stack);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
