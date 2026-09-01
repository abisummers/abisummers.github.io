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

/**
 * Format a UTC timestamp (e.g. DTSTAMP) as YYYYMMDDTHHMMSSZ.
 */
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Format the wall-clock components of a date as YYYYMMDDTHHMMSS (no zone
 * suffix). The Date is expected to carry the Paris wall-clock time in its UTC
 * fields (see bookingDateRange), so this is paired with TZID=Europe/Paris.
 */
function formatLocalICalDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
  );
}

// VTIMEZONE for Europe/Paris (CET/CEST) so calendar clients resolve the
// TZID=Europe/Paris wall-clock times to the correct instant, DST included.
const parisVTimezone = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Paris",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

interface IcalOptions {
  uid: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  method: string;
  status: string;
  sequence: number;
}

/**
 * Build a base64-encoded iCalendar attachment for a booking event.
 */
function buildIcalContent(options: IcalOptions): string {
  const event = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Abi Summers//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${options.method}`,
    ...parisVTimezone,
    "BEGIN:VEVENT",
    `DTSTART;TZID=Europe/Paris:${formatLocalICalDate(options.start)}`,
    `DTEND;TZID=Europe/Paris:${formatLocalICalDate(options.end)}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `ORGANIZER:mailto:bookings@abisummers.com`,
    `UID:${options.uid}`,
    `SUMMARY:${options.summary}`,
    `DESCRIPTION:${options.description}`,
    "LOCATION:Paris, France",
    `STATUS:${options.status}`,
    `SEQUENCE:${options.sequence}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return Buffer.from(event).toString("base64");
}

/**
 * Compute the start and end of a booking from its date/time/duration.
 *
 * The entered time is treated as a Paris wall-clock time. We parse it as UTC so
 * the wall-clock components are preserved verbatim regardless of the server's
 * timezone; formatLocalICalDate reads them back and they are tagged
 * TZID=Europe/Paris in the iCal output. The duration is added as elapsed
 * wall-clock hours.
 */
function bookingDateRange(date: string, time: string, duration: number) {
  const start = new Date(`${date}T${time}:00Z`);
  const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
  return { start, end };
}

interface CheckoutDetails {
  origin: string;
  tour: string;
  description: string;
  totalPrice: number;
  email: string;
  metadata: Record<string, string>;
}

/**
 * Create a Stripe Checkout session for a confirmed booking and return its
 * payment URL and id. Throws if Stripe rejects the request or omits the URL.
 */
async function createCheckoutSession(
  details: CheckoutDetails,
): Promise<{ paymentUrl: string; sessionId: string }> {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: details.tour,
            description: details.description,
          },
          unit_amount: Math.round(details.totalPrice * 100),
        },
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    mode: "payment",
    success_url: `${details.origin}/book/paid/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${details.origin}/book/`,
    customer_email: details.email,
    customer_creation: "always",
    metadata: details.metadata,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return { paymentUrl: session.url, sessionId: session.id };
}

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

      const { start, end } = bookingDateRange(
        input.date,
        input.time,
        input.duration,
      );

      const icalContent = buildIcalContent({
        uid: `booking-${bookingId}@abisummers.com`,
        summary: input.tour,
        description: bookingDetails.replace(/\n/g, "\\n"),
        start,
        end,
        method: "REQUEST",
        status: "TENTATIVE",
        sequence: 0,
      });

      try {
        await resend.emails.send({
          from: adminEmail,
          to: adminEmail,
          subject: `New Booking Request: ${input.tour}`,
          text: `New booking request received:\n\n${bookingDetails}\n\nTo confirm this booking, click here:\n${confirmUrl}\n\nThis link expires in 48 hours and can only be used once.\n\n`,
          attachments: [{ filename: "booking.ics", content: icalContent }],
        });

        await resend.emails.send({
          from: adminEmail,
          to: input.email,
          subject: `Booking Request Received: ${input.tour}`,
          text: `Hello ${input.name},\n\nThank you for your booking request for ${input.tour} on ${input.date} at ${input.time}.\n\nWe'll confirm availability and send you payment details within 24 hours.\n\nBooking details:\n${bookingDetails}\n\nBest regards,\nAbi Summers\n\n`,
          attachments: [{ filename: "booking.ics", content: icalContent }],
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

        const { paymentUrl } = await createCheckoutSession({
          origin: context.url.origin,
          tour: bookingData.tour,
          description: `Tour on ${bookingData.date} at ${bookingData.time}`,
          totalPrice: input.totalPrice,
          email: bookingData.email,
          metadata: {
            bookingToken: input.token,
            customerName: bookingData.name,
            tourName: bookingData.tour,
            tourDate: bookingData.date,
            tourTime: bookingData.time,
          },
        });

        const { start, end } = bookingDateRange(
          bookingData.date,
          bookingData.time,
          bookingData.duration,
        );

        const icalContent = buildIcalContent({
          uid: `booking-${input.token}@abisummers.com`,
          summary: `${bookingData.tour} - CONFIRMED`,
          description: "Booking confirmed",
          start,
          end,
          method: "PUBLISH",
          status: "CONFIRMED",
          sequence: 1,
        });

        await resend.emails.send({
          from: adminEmail,
          to: bookingData.email,
          subject: `Booking Confirmed: ${bookingData.tour}`,
          text: `Hello ${bookingData.name},\n\nGreat news! Your booking for ${bookingData.tour} on ${bookingData.date} at ${bookingData.time} has been confirmed.\n\n${bookingDetails}\n\nTotal price: €${input.totalPrice}\n\nPlease complete your payment here:\n${paymentUrl}\n\nWe look forward to seeing you!\n\nBest regards,\nAbi Summers\n\n`,
          attachments: [
            { filename: "booking-confirmed.ics", content: icalContent },
          ],
        });

        await resend.emails.send({
          from: adminEmail,
          to: adminEmail,
          subject: `Booking Confirmed: ${bookingData.tour}`,
          text: `You confirmed the booking for:\n\nCustomer: ${bookingData.name} (${bookingData.email})\nTour: ${bookingData.tour}\nDate: ${bookingData.date} at ${bookingData.time}\n\n`,
          attachments: [
            { filename: "booking-confirmed.ics", content: icalContent },
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

  createManualBooking: defineAction({
    accept: "form",
    input: z.object({
      secret: z.string(),
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      date: z.string(),
      time: z.string(),
      duration: z.number(),
      guests: z.number(),
      tour: z.string(),
      description: z.string().optional(),
      message: z.string().optional(),
      totalPrice: z.number().positive(),
    }),
    handler: async (input, context) => {
      if (
        !import.meta.env.ADMIN_PASSWORD ||
        input.secret !== import.meta.env.ADMIN_PASSWORD
      ) {
        throw new Error("Unauthorized");
      }

      const { secret, totalPrice, description, ...bookingData } = input;

      const bookingDetails = Object.entries(bookingData)
        .map(([key, value]) => `${key}: ${value == undefined ? "N/A" : value}`)
        .join("\n");

      try {
        const { paymentUrl, sessionId } = await createCheckoutSession({
          origin: context.url.origin,
          tour: bookingData.tour,
          description:
            description || `Tour on ${bookingData.date} at ${bookingData.time}`,
          totalPrice,
          email: bookingData.email,
          metadata: {
            manual: "true",
            customerName: bookingData.name,
            tourName: bookingData.tour,
            tourDate: bookingData.date,
            tourTime: bookingData.time,
          },
        });

        const { start, end } = bookingDateRange(
          bookingData.date,
          bookingData.time,
          bookingData.duration,
        );

        const icalContent = buildIcalContent({
          uid: `booking-${sessionId}@abisummers.com`,
          summary: `${bookingData.tour} - CONFIRMED`,
          description: "Booking confirmed",
          start,
          end,
          method: "PUBLISH",
          status: "CONFIRMED",
          sequence: 1,
        });

        await resend.emails.send({
          from: adminEmail,
          to: bookingData.email,
          subject: `Booking Confirmed: ${bookingData.tour}`,
          text: `Hello ${bookingData.name},\n\nGreat news! Your booking for ${bookingData.tour} on ${bookingData.date} at ${bookingData.time} has been confirmed.\n\n${bookingDetails}\n\nTotal price: €${totalPrice}\n\nPlease complete your payment here:\n${paymentUrl}\n\nWe look forward to seeing you!\n\nBest regards,\nAbi Summers\n\n`,
          attachments: [
            { filename: "booking-confirmed.ics", content: icalContent },
          ],
        });

        await resend.emails.send({
          from: adminEmail,
          to: adminEmail,
          subject: `Manual Booking Created: ${bookingData.tour}`,
          text: `You created a manual booking for:\n\nCustomer: ${bookingData.name} (${bookingData.email})\nTour: ${bookingData.tour}\nDate: ${bookingData.date} at ${bookingData.time}\nTotal price: €${totalPrice}\n\n${bookingDetails}\n\n`,
          attachments: [
            { filename: "booking-confirmed.ics", content: icalContent },
          ],
        });

        return { success: true, paymentUrl };
      } catch (error) {
        console.error("Error creating manual booking:", error);
        throw new Error("Failed to create manual booking");
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

        const { start, end } = bookingDateRange(
          bookingData.date,
          bookingData.time,
          bookingData.duration,
        );

        const icalContent = buildIcalContent({
          uid: `booking-${input.token}@abisummers.com`,
          summary: `${bookingData.tour} - CANCELLED`,
          description: "Booking cancelled",
          start,
          end,
          method: "CANCEL",
          status: "CANCELLED",
          sequence: 2,
        });

        await resend.emails.send({
          from: adminEmail,
          to: bookingData.email,
          subject: `Booking Cancelled: ${bookingData.tour}`,
          text: `Hello ${bookingData.name},\n\nUnfortunately, your booking request for ${bookingData.tour} on ${bookingData.date} at ${bookingData.time} has been cancelled.\n\nIf you have any questions, please contact us.\n\nBest regards,\nAbi Summers\n\n`,
          attachments: [
            { filename: "booking-cancelled.ics", content: icalContent },
          ],
        });

        await resend.emails.send({
          from: adminEmail,
          to: adminEmail,
          subject: `Booking Cancelled: ${bookingData.tour}`,
          text: `You cancelled the booking for:\n\nCustomer: ${bookingData.name} (${bookingData.email})\nTour: ${bookingData.tour}\nDate: ${bookingData.date} at ${bookingData.time}\n\n`,
          attachments: [
            { filename: "booking-cancelled.ics", content: icalContent },
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
