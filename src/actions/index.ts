import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { Resend } from "resend";
import Stripe from "stripe";
import {
  storeBooking,
  validateToken,
  markBookingUsed,
  updateBooking,
  markReminderSent,
  getAllBookings,
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

  sendReminder: defineAction({
    accept: "json",
    input: z.object({
      bookingId: z.string(),
    }),
    handler: async (input) => {
      try {
        const bookings = await getAllBookings();
        const bookingEntry = bookings.find(
          (b) => b.bookingId === input.bookingId,
        );

        if (!bookingEntry) {
          throw new Error("Booking not found");
        }

        const { booking } = bookingEntry;

        if (booking.status !== "confirmed") {
          throw new Error("Only confirmed bookings can receive reminders");
        }

        const { bookingData } = booking;

        await resend.emails.send({
          from: adminEmail,
          to: bookingData.email,
          subject: `Reminder: Your tour - ${bookingData.tour}`,
          text: `Hello ${bookingData.name},\n\nThis is a friendly reminder about your upcoming tour!\n\nTour: ${bookingData.tour}\nDate: ${bookingData.date}\nTime: ${bookingData.time}\nGuests: ${bookingData.guests}\n\nMeeting point: We'll send you the exact meeting location and any last-minute details via email. Please check your inbox closer to the tour time.\n\nWhat to bring:\n- Comfortable walking shoes\n- Weather-appropriate clothing\n- Water bottle\n- Camera (optional)\n\nIf you have any questions or need to make changes, please reply to this email.\n\nWe're looking forward to showing you around Paris!\n\nBest regards,\nAbi Summers\nbookings@abisummers.com\n\n`,
        });

        await markReminderSent(input.bookingId);

        return { success: true };
      } catch (error) {
        console.error("Error sending reminder:", error);
        throw new Error("Failed to send reminder");
      }
    },
  }),

  checkAndSendReminders: defineAction({
    accept: "json",
    input: z.object({}).optional(),
    handler: async () => {
      try {
        const bookings = await getAllBookings();
        const confirmedBookings = bookings.filter(
          (b) => b.booking.status === "confirmed" && !b.booking.used,
        );

        const now = Date.now();
        const twentyFourHoursFromNow = now + 24 * 60 * 60 * 1000;
        const twentyThreeHoursFromNow = now + 23 * 60 * 60 * 1000;

        const remindersToSend: string[] = [];

        for (const { bookingId, booking } of confirmedBookings) {
          const { bookingData } = booking;

          // Skip if reminder already sent
          if (booking.reminderSent) {
            continue;
          }

          // Parse tour date and time
          const tourDateTime = new Date(
            `${bookingData.date}T${bookingData.time}:00`,
          );
          const tourTimestamp = tourDateTime.getTime();

          // Check if tour is between 23 and 24 hours from now
          if (
            tourTimestamp >= twentyThreeHoursFromNow &&
            tourTimestamp <= twentyFourHoursFromNow
          ) {
            remindersToSend.push(bookingId);

            await resend.emails.send({
              from: adminEmail,
              to: bookingData.email,
              subject: `Reminder: Your tour tomorrow - ${bookingData.tour}`,
              text: `Hello ${bookingData.name},\n\nThis is a friendly reminder about your upcoming tour!\n\nTour: ${bookingData.tour}\nDate: ${bookingData.date}\nTime: ${bookingData.time}\nGuests: ${bookingData.guests}\n\nMeeting point: We'll send you the exact meeting location and any last-minute details via email. Please check your inbox closer to the tour time.\n\nWhat to bring:\n- Comfortable walking shoes\n- Weather-appropriate clothing\n- Water bottle\n- Camera (optional)\n\nIf you have any questions or need to make changes, please reply to this email.\n\nWe're looking forward to showing you around Paris!\n\nBest regards,\nAbi Summers\nbookings@abisummers.com\n\n`,
            });

            await markReminderSent(bookingId);
          }
        }

        return {
          success: true,
          totalBookings: confirmedBookings.length,
          remindersSent: remindersToSend.length,
          bookingIds: remindersToSend,
        };
      } catch (error) {
        console.error("Error checking and sending reminders:", error);
        throw new Error("Failed to process reminders");
      }
    },
  }),
};
