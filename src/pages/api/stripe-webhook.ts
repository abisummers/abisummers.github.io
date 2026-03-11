import type { APIRoute } from "astro";
import Stripe from "stripe";
import { server } from "../../actions";

if (!import.meta.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
}

if (!import.meta.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error(
    "STRIPE_WEBHOOK_SECRET is not defined in environment variables",
  );
}

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature provided", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      import.meta.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(
      `Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      {
        status: 400,
      },
    );
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      const bookingToken = session.metadata?.bookingToken;

      if (!bookingToken) {
        console.error("No booking token in session metadata");
        return new Response("No booking token found", { status: 400 });
      }

      if (!session.amount_total) {
        console.error("No amount in session");
        return new Response("No amount found", { status: 400 });
      }

      // Process payment via action (keeps business logic centralized)
      await server.processPayment({
        bookingToken,
        stripeSessionId: session.id,
        amountTotal: session.amount_total,
        customerId:
          typeof session.customer === "string" ? session.customer : undefined,
      });

      console.log(`Payment processed for session ${session.id}`);
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response("Error processing payment", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
