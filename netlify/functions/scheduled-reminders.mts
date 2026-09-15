import { schedule } from "@netlify/functions";
import { actions } from "astro:actions";

/**
 * Scheduled function that runs every hour to check for tours happening in 24 hours
 * and sends reminder emails to customers.
 *
 * This is a thin wrapper around the checkAndSendReminders action to keep
 * all business logic centralized in src/actions/index.ts
 */
export default schedule("0 * * * *", async () => {
  console.log("Running scheduled reminder check...");

  try {
    const result = await actions.checkAndSendReminders({});

    console.log(
      `Processed ${result.totalBookings} bookings, sent ${result.remindersSent} reminders`,
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed ${result.totalBookings} bookings, sent ${result.remindersSent} reminders`,
        bookingIds: result.bookingIds,
      }),
    };
  } catch (error) {
    console.error("Error in scheduled reminder function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process reminders" }),
    };
  }
});
