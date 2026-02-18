import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { Resend } from "resend";
import Stripe from "stripe";

if (!import.meta.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not defined in environment variables");
}

if (!import.meta.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
}

const resend = new Resend(import.meta.env.RESEND_API_KEY);
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
      const adminEmail = "hello@haroen.me";

      const bookingDetails = Object.entries(input)
        .map(([key, value]) => `${key}: ${value == undefined ? "N/A" : value}`)
        .join("\n");

      const bookingId = Buffer.from(
        JSON.stringify({
          ...input,
          timestamp: Date.now(),
        }),
      ).toString("base64url");

      const confirmUrl = `${context.url.origin}/confirm-booking/?token=${bookingId}`;

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
          text: `New booking request received:\n\n${bookingDetails}\n\nTo confirm this booking, click here:\n${confirmUrl}\n\n`,
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
    input: z.object({
      token: z.string(),
      totalPrice: z.number(),
    }),
    handler: async (input, context) => {
      const adminEmail = "bookings@abisummers.com";

      try {
        const bookingData = JSON.parse(
          Buffer.from(input.token, "base64url").toString(),
        );

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
          success_url: `${context.url.origin}/booking-paid/?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${context.url.origin}/confirm-booking/?token=${input.token}`,
          customer_email: bookingData.email,
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
          text: `Hello ${bookingData.name},\n\nGreat news! Your booking for ${bookingData.tour} on ${bookingData.date} at ${bookingData.time} has been confirmed.\n\nTotal price: €${input.totalPrice}\n\nPlease complete your payment here:\n${session.url}\n\nWe look forward to seeing you!\n\nBest regards,\nAbi Summers\n\n`,
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
      const adminEmail = "bookings@abisummers";

      try {
        const bookingData = JSON.parse(
          Buffer.from(input.token, "base64url").toString(),
        );

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

        return { success: true };
      } catch (error) {
        console.error("Error cancelling booking:", error);
        throw new Error("Failed to cancel booking");
      }
    },
  }),
};
