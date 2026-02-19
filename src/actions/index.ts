import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import Stripe from "stripe";
import {
  storeBooking,
  validateToken,
  markBookingUsed,
  markBookingPaid,
  updateBooking,
  type BookingData,
} from "../lib/booking-tokens";
import {
  sendBookingRequestEmails,
  sendBookingConfirmationEmails,
  sendBookingCancellationEmails,
  sendPaymentConfirmationEmails,
} from "../lib/email-helpers";

if (!import.meta.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
}

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export const server = {
  submitBooking: defineAction({
    accept: "form",
    input: z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      date: z.string(),
      time: z.string(),
      duration: z.number(),
      guests: z.number(),
      tour: z.string(),
      message: z.string().optional(),
    }),
    handler: async (input, context) => {
      const bookingData: BookingData = {
        ...input,
        timestamp: Date.now(),
      };

      const { bookingId, token } = await storeBooking(bookingData);

      const confirmUrl = `${context.url.origin}/book/confirm/?token=${token}`;

      try {
        await sendBookingRequestEmails(bookingData, bookingId, confirmUrl);

        return { success: true };
      } catch (error) {
        console.error("Error sending booking emails:", error);
        throw new Error("Failed to send booking confirmation");
      }
    },
  }),

  confirmBooking: defineAction({
    accept: "json",
    input: z
      .object({
        token: z.string(),
        totalPrice: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        date: z.string().optional(),
        time: z.string().optional(),
        message: z.string().optional(),
      })
      .passthrough(),
    handler: async (input, context) => {
      try {
        const validation = await validateToken(input.token);

        if (!validation.valid || !validation.booking || !validation.bookingId) {
          throw new Error("Invalid, expired, or already used token");
        }

        const { token, totalPrice, ...updates } = input;

        if (Object.keys(updates).length > 0) {
          await updateBooking(validation.bookingId, updates);
        }

        const bookingData = {
          ...validation.booking.bookingData,
          ...updates,
        };

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name: bookingData.tour,
                  description: `Tour on ${bookingData.date} at ${bookingData.time}`,
                },
                unit_amount: Math.round(input.totalPrice * 100),
              },
              quantity: 1,
            },
          ],
          allow_promotion_codes: true,
          mode: "payment",
          success_url: `${context.url.origin}/book/paid/?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${context.url.origin}/book/`,
          customer_email: bookingData.email,
          customer_creation: "always",
          metadata: {
            bookingToken: input.token,
            customerName: bookingData.name,
            tourName: bookingData.tour,
            tourDate: bookingData.date,
            tourTime: bookingData.time,
          },
        });

        await sendBookingConfirmationEmails(
          bookingData,
          validation.bookingId,
          input.totalPrice,
          session.url!,
        );

        await markBookingUsed(validation.bookingId, "confirmed");

        return { success: true };
      } catch (error) {
        console.error("Error confirming booking:", error);
        throw new Error("Failed to confirm booking");
      }
    },
  }),

  processPayment: defineAction({
    accept: "json",
    input: z.object({
      bookingToken: z.string(),
      stripeSessionId: z.string(),
      amountTotal: z.number(),
      customerId: z.string().optional(),
    }),
    handler: async (input) => {
      try {
        const validation = await validateToken(input.bookingToken);

        if (!validation.valid || !validation.booking || !validation.bookingId) {
          throw new Error("Invalid, expired, or already used token");
        }

        const bookingData = validation.booking.bookingData;

        await markBookingPaid(validation.bookingId);

        const amountPaid = (input.amountTotal / 100).toFixed(2);

        await sendPaymentConfirmationEmails(
          bookingData,
          validation.bookingId,
          amountPaid,
          input.stripeSessionId,
          input.customerId,
        );

        return { success: true };
      } catch (error) {
        console.error("Error processing payment:", error);
        throw new Error("Failed to process payment");
      }
    },
  }),

  cancelBooking: defineAction({
    accept: "json",
    input: z.object({
      token: z.string(),
    }),
    handler: async (input) => {
      try {
        const validation = await validateToken(input.token);

        if (!validation.valid || !validation.booking || !validation.bookingId) {
          throw new Error("Invalid, expired, or already used token");
        }

        const bookingData = validation.booking.bookingData;

        await sendBookingCancellationEmails(bookingData, validation.bookingId);

        await markBookingUsed(validation.bookingId, "cancelled");

        return { success: true };
      } catch (error) {
        console.error("Error cancelling booking:", error);
        throw new Error("Failed to cancel booking");
      }
    },
  }),
};
