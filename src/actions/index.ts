import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { Resend } from "resend";
import Stripe from "stripe";
import {
  storeBooking,
  validateToken,
  markBookingUsed,
  updateBooking,
  type BookingData,
} from "../lib/booking-tokens";

if (!import.meta.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not defined in environment variables");
}

if (!import.meta.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
}

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

const adminEmail = "Abi Summers <bookings@abisummers.com>";

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
      const bookingDetails = Object.entries(input)
        .map(([key, value]) => `${key}: ${value == undefined ? "N/A" : value}`)
        .join("\n");

      const bookingData: BookingData = {
        ...input,
        timestamp: Date.now(),
      };

      const { bookingId, token } = await storeBooking(bookingData);

      const confirmUrl = `${context.url.origin}/book/confirm/?token=${token}`;

      const startDateTime = new Date(`${input.date}T${input.time}:00`);
      const endDateTime = new Date(
        startDateTime.getTime() + input.duration * 60 * 60 * 1000,
      );

      const formatICalDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };

      const icalEvent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Abi Summers//Booking//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        `DTSTART:${formatICalDate(startDateTime)}`,
        `DTEND:${formatICalDate(endDateTime)}`,
        `DTSTAMP:${formatICalDate(new Date())}`,
        `ORGANIZER:mailto:bookings@abisummers.com`,
        `UID:booking-${bookingId}@abisummers.com`,
        `SUMMARY:${input.tour}`,
        `DESCRIPTION:${bookingDetails.replace(/\n/g, "\\n")}`,
        "LOCATION:Paris, France",
        "STATUS:TENTATIVE",
        "SEQUENCE:0",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      try {
        await resend.emails.send({
          from: adminEmail,
          to: adminEmail,
          subject: `New Booking Request: ${input.tour}`,
          text: `New booking request received:\n\n${bookingDetails}\n\nTo confirm this booking, click here:\n${confirmUrl}\n\nThis link expires in 48 hours and can only be used once.\n\n`,
          attachments: [
            {
              filename: "booking.ics",
              content: Buffer.from(icalEvent).toString("base64"),
            },
          ],
        });

        await resend.emails.send({
          from: adminEmail,
          to: input.email,
          subject: `Booking Request Received: ${input.tour}`,
          text: `Hello ${input.name},\n\nThank you for your booking request for ${input.tour} on ${input.date} at ${input.time}.\n\nWe'll confirm availability and send you payment details within 24 hours.\n\nBooking details:\n${bookingDetails}\n\nBest regards,\nAbi Summers\n\n`,
          attachments: [
            {
              filename: "booking.ics",
              content: Buffer.from(icalEvent).toString("base64"),
            },
          ],
        });

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

        const bookingDetails = Object.entries(bookingData)
          .map(
            ([key, value]) => `${key}: ${value == undefined ? "N/A" : value}`,
          )
          .join("\n");

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

        const startDateTime = new Date(
          `${bookingData.date}T${bookingData.time}:00`,
        );
        const endDateTime = new Date(
          startDateTime.getTime() + bookingData.duration * 60 * 60 * 1000,
        );

        const formatICalDate = (date: Date) => {
          return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        };

        const icalEvent = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Abi Summers//Booking//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          "BEGIN:VEVENT",
          `DTSTART:${formatICalDate(startDateTime)}`,
          `DTEND:${formatICalDate(endDateTime)}`,
          `DTSTAMP:${formatICalDate(new Date())}`,
          `ORGANIZER:mailto:bookings@abisummers.com`,
          `UID:booking-${input.token}@abisummers.com`,
          `SUMMARY:${bookingData.tour} - CONFIRMED`,
          `DESCRIPTION:Booking confirmed`,
          "LOCATION:Paris, France",
          "STATUS:CONFIRMED",
          "SEQUENCE:1",
          "END:VEVENT",
          "END:VCALENDAR",
        ].join("\r\n");

        await resend.emails.send({
          from: adminEmail,
          to: bookingData.email,
          subject: `Booking Confirmed: ${bookingData.tour}`,
          text: `Hello ${bookingData.name},\n\nGreat news! Your booking for ${bookingData.tour} on ${bookingData.date} at ${bookingData.time} has been confirmed.\n\n${bookingDetails}\n\nTotal price: €${input.totalPrice}\n\nPlease complete your payment here:\n${session.url}\n\nWe look forward to seeing you!\n\nBest regards,\nAbi Summers\n\n`,
          attachments: [
            {
              filename: "booking-confirmed.ics",
              content: Buffer.from(icalEvent).toString("base64"),
            },
          ],
        });

        await resend.emails.send({
          from: adminEmail,
          to: adminEmail,
          subject: `Booking Confirmed: ${bookingData.tour}`,
          text: `You confirmed the booking for:\n\nCustomer: ${bookingData.name} (${bookingData.email})\nTour: ${bookingData.tour}\nDate: ${bookingData.date} at ${bookingData.time}\n\n`,
          attachments: [
            {
              filename: "booking-confirmed.ics",
              content: Buffer.from(icalEvent).toString("base64"),
            },
          ],
        });

        await markBookingUsed(validation.bookingId, "confirmed");

        return { success: true };
      } catch (error) {
        console.error("Error confirming booking:", error);
        throw new Error("Failed to confirm booking");
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

        const startDateTime = new Date(
          `${bookingData.date}T${bookingData.time}:00`,
        );
        const endDateTime = new Date(
          startDateTime.getTime() + bookingData.duration * 60 * 60 * 1000,
        );

        const formatICalDate = (date: Date) => {
          return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        };

        const icalEvent = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Abi Summers//Booking//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:CANCEL",
          "BEGIN:VEVENT",
          `DTSTART:${formatICalDate(startDateTime)}`,
          `DTEND:${formatICalDate(endDateTime)}`,
          `DTSTAMP:${formatICalDate(new Date())}`,
          `ORGANIZER:mailto:bookings@abisummers.com`,
          `UID:booking-${input.token}@abisummers.com`,
          `SUMMARY:${bookingData.tour} - CANCELLED`,
          `DESCRIPTION:Booking cancelled`,
          "LOCATION:Paris, France",
          "STATUS:CANCELLED",
          "SEQUENCE:2",
          "END:VEVENT",
          "END:VCALENDAR",
        ].join("\r\n");

        await resend.emails.send({
          from: adminEmail,
          to: bookingData.email,
          subject: `Booking Cancelled: ${bookingData.tour}`,
          text: `Hello ${bookingData.name},\n\nUnfortunately, your booking request for ${bookingData.tour} on ${bookingData.date} at ${bookingData.time} has been cancelled.\n\nIf you have any questions, please contact us.\n\nBest regards,\nAbi Summers\n\n`,
          attachments: [
            {
              filename: "booking-cancelled.ics",
              content: Buffer.from(icalEvent).toString("base64"),
            },
          ],
        });

        await resend.emails.send({
          from: adminEmail,
          to: adminEmail,
          subject: `Booking Cancelled: ${bookingData.tour}`,
          text: `You cancelled the booking for:\n\nCustomer: ${bookingData.name} (${bookingData.email})\nTour: ${bookingData.tour}\nDate: ${bookingData.date} at ${bookingData.time}\n\n`,
          attachments: [
            {
              filename: "booking-cancelled.ics",
              content: Buffer.from(icalEvent).toString("base64"),
            },
          ],
        });

        await markBookingUsed(validation.bookingId, "cancelled");

        return { success: true };
      } catch (error) {
        console.error("Error cancelling booking:", error);
        throw new Error("Failed to cancel booking");
      }
    },
  }),

  submitReview: defineAction({
    accept: "form",
    input: z.object({
      tourName: z.string().optional(),
      customerName: z.string().min(2),
      email: z.string().email(),
      rating: z.coerce.number().min(1).max(5),
      title: z.string().min(5).max(100),
      comment: z.string().min(20).max(1000),
      tourDate: z.string(),
      bookingToken: z.string().optional(),
    }),
    handler: async (input) => {
      try {
        let isVerified = false;
        if (input.bookingToken) {
          const validation = await validateToken(input.bookingToken);
          if (validation.valid && validation.booking) {
            isVerified = true;
          }
        }

        const reviewData = {
          tourName: input.tourName || undefined,
          customerName: input.customerName,
          email: input.email,
          rating: input.rating,
          title: input.title,
          comment: input.comment,
          tourDate: input.tourDate,
          submittedDate: new Date().toISOString(),
          verified: isVerified,
        };

        await resend.emails.send({
          from: adminEmail,
          to: adminEmail,
          subject: `New Review Submission`,
          text: `New review submitted for approval:

${input.tourName ? `Tour: ${input.tourName}\n` : ""}Customer: ${input.customerName} (${input.email})
Rating: ${"⭐".repeat(input.rating)} (${input.rating}/5)
Verified: ${isVerified ? "Yes" : "No"}

Title: ${input.title}

Review:
${input.comment}

Tour Date: ${input.tourDate}

To publish this review, create a JSON file in src/content/reviews/ with the following content:

${JSON.stringify(reviewData, null, 2)}

`,
        });

        await resend.emails.send({
          from: adminEmail,
          to: input.email,
          subject: "Thank you for your review!",
          text: `Hello ${input.customerName},

Thank you for taking the time to share your experience${input.tourName ? ` on the ${input.tourName} tour` : " with us"}!

Your review has been submitted and will be published after a quick review.

Your feedback:
Rating: ${"⭐".repeat(input.rating)} (${input.rating}/5)
${input.title}

${input.comment}

Best regards,
Abi Summers

`,
        });

        return { success: true };
      } catch (error) {
        console.error("Error submitting review:", error);
        throw new Error("Failed to submit review");
      }
    },
  }),
};
