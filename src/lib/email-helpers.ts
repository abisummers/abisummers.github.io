import { Resend } from "resend";
import type { BookingData } from "./booking-tokens";

if (!import.meta.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not defined in environment variables");
}

export const resend = new Resend(import.meta.env.RESEND_API_KEY);
export const adminEmail = "Abi Summers <bookings@abisummers.com>";

/**
 * Format date for iCalendar
 */
export function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Create iCalendar event
 */
export function createICalEvent(
  bookingData: BookingData,
  bookingId: string,
  status: "TENTATIVE" | "CONFIRMED" | "CANCELLED",
  sequence: number,
  method: "REQUEST" | "PUBLISH" | "CANCEL",
): string {
  const startDateTime = new Date(`${bookingData.date}T${bookingData.time}:00`);
  const endDateTime = new Date(
    startDateTime.getTime() + bookingData.duration * 60 * 60 * 1000,
  );

  const statusSuffix =
    status === "TENTATIVE" ? "" : ` - ${status.toUpperCase()}`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Abi Summers//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `DTSTART:${formatICalDate(startDateTime)}`,
    `DTEND:${formatICalDate(endDateTime)}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `ORGANIZER:mailto:bookings@abisummers.com`,
    `UID:booking-${bookingId}@abisummers.com`,
    `SUMMARY:${bookingData.tour}${statusSuffix}`,
    `DESCRIPTION:Booking ${status.toLowerCase()}`,
    "LOCATION:Paris, France",
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Format booking details for email
 */
export function formatBookingDetails(bookingData: BookingData): string {
  return Object.entries(bookingData)
    .map(([key, value]) => `${key}: ${value === undefined ? "N/A" : value}`)
    .join("\n");
}

/**
 * Send booking request emails
 */
export async function sendBookingRequestEmails(
  bookingData: BookingData,
  bookingId: string,
  confirmUrl: string,
): Promise<void> {
  const bookingDetails = formatBookingDetails(bookingData);
  const icalEvent = createICalEvent(
    bookingData,
    bookingId,
    "TENTATIVE",
    0,
    "REQUEST",
  );

  await resend.emails.send({
    from: adminEmail,
    to: adminEmail,
    subject: `New Booking Request: ${bookingData.tour}`,
    text: `New booking request received:

${bookingDetails}

To confirm this booking, click here:
${confirmUrl}

This link expires in 48 hours and can only be used once.

`,
    attachments: [
      {
        filename: "booking.ics",
        content: Buffer.from(icalEvent).toString("base64"),
      },
    ],
  });

  await resend.emails.send({
    from: adminEmail,
    to: bookingData.email,
    subject: `Booking Request Received: ${bookingData.tour}`,
    text: `Hello ${bookingData.name},

Thank you for your booking request for ${bookingData.tour} on ${bookingData.date} at ${bookingData.time}.

We'll confirm availability and send you payment details within 24 hours.

Booking details:
${bookingDetails}

Best regards,
Abi Summers

`,
    attachments: [
      {
        filename: "booking.ics",
        content: Buffer.from(icalEvent).toString("base64"),
      },
    ],
  });
}

/**
 * Send booking confirmation emails
 */
export async function sendBookingConfirmationEmails(
  bookingData: BookingData,
  bookingId: string,
  totalPrice: number,
  paymentUrl: string,
): Promise<void> {
  const bookingDetails = formatBookingDetails(bookingData);
  const icalEvent = createICalEvent(
    bookingData,
    bookingId,
    "CONFIRMED",
    1,
    "PUBLISH",
  );

  await resend.emails.send({
    from: adminEmail,
    to: bookingData.email,
    subject: `Booking Confirmed: ${bookingData.tour}`,
    text: `Hello ${bookingData.name},

Great news! Your booking for ${bookingData.tour} on ${bookingData.date} at ${bookingData.time} has been confirmed.

${bookingDetails}

Total price: €${totalPrice}

Please complete your payment here:
${paymentUrl}

We look forward to seeing you!

Best regards,
Abi Summers

`,
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
    text: `You confirmed the booking for:

Customer: ${bookingData.name} (${bookingData.email})
Tour: ${bookingData.tour}
Date: ${bookingData.date} at ${bookingData.time}

`,
    attachments: [
      {
        filename: "booking-confirmed.ics",
        content: Buffer.from(icalEvent).toString("base64"),
      },
    ],
  });
}

/**
 * Send booking cancellation emails
 */
export async function sendBookingCancellationEmails(
  bookingData: BookingData,
  bookingId: string,
): Promise<void> {
  const icalEvent = createICalEvent(
    bookingData,
    bookingId,
    "CANCELLED",
    2,
    "CANCEL",
  );

  await resend.emails.send({
    from: adminEmail,
    to: bookingData.email,
    subject: `Booking Cancelled: ${bookingData.tour}`,
    text: `Hello ${bookingData.name},

Unfortunately, your booking request for ${bookingData.tour} on ${bookingData.date} at ${bookingData.time} has been cancelled.

If you have any questions, please contact us.

Best regards,
Abi Summers

`,
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
    text: `You cancelled the booking for:

Customer: ${bookingData.name} (${bookingData.email})
Tour: ${bookingData.tour}
Date: ${bookingData.date} at ${bookingData.time}

`,
    attachments: [
      {
        filename: "booking-cancelled.ics",
        content: Buffer.from(icalEvent).toString("base64"),
      },
    ],
  });
}

/**
 * Send payment confirmation emails
 */
export async function sendPaymentConfirmationEmails(
  bookingData: BookingData,
  bookingId: string,
  amountPaid: string,
  stripeSessionId: string,
  customerId?: string,
): Promise<void> {
  const icalEvent = createICalEvent(
    bookingData,
    bookingId,
    "CONFIRMED",
    2,
    "PUBLISH",
  );

  await resend.emails.send({
    from: adminEmail,
    to: bookingData.email,
    subject: `Payment Received - Your Tour is Confirmed!`,
    text: `Hello ${bookingData.name},

Thank you! Your payment has been received and your booking is now fully confirmed.

Tour: ${bookingData.tour}
Date: ${bookingData.date}
Time: ${bookingData.time}
Duration: ${bookingData.duration} hours
Guests: ${bookingData.guests}
Amount Paid: €${amountPaid}

${bookingData.message ? `Your message: ${bookingData.message}\n\n` : ""}Meeting Point: I'll send you the exact meeting point 24 hours before the tour.

What to Bring: Comfortable walking shoes, weather-appropriate clothing, and your camera!

I'm excited to show you around Paris! If you have any questions before the tour, feel free to reply to this email.

Best regards,
Abi Summers

`,
    attachments: [
      {
        filename: "tour-confirmed.ics",
        content: Buffer.from(icalEvent).toString("base64"),
      },
    ],
  });

  await resend.emails.send({
    from: adminEmail,
    to: adminEmail,
    subject: `Payment Received: ${bookingData.tour}`,
    text: `Payment received for booking:

Customer: ${bookingData.name} (${bookingData.email})
${bookingData.phone ? `Phone: ${bookingData.phone}` : ""}
Tour: ${bookingData.tour}
Date: ${bookingData.date} at ${bookingData.time}
Guests: ${bookingData.guests}
Amount Paid: €${amountPaid}

Stripe Session ID: ${stripeSessionId}
${customerId ? `Customer ID: ${customerId}` : ""}

${bookingData.message ? `Message from customer:\n${bookingData.message}` : ""}
`,
    attachments: [
      {
        filename: "tour-confirmed.ics",
        content: Buffer.from(icalEvent).toString("base64"),
      },
    ],
  });
}
