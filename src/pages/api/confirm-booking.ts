import type { APIRoute } from "astro";
import { actions } from "astro:actions";

export const POST: APIRoute = async (context) => {
  const { request, redirect } = context;
  const formData = await request.formData();
  const token = formData.get("token") as string;
  const action = formData.get("action") as string;
  const totalPrice = parseFloat(formData.get("totalPrice") as string);

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  try {
    if (action === "confirm") {
      const { error } = await context.callAction(actions.confirmBooking, {
        token,
        totalPrice,
      });
      if (error) throw error;
      return redirect("/book/confirmed/?status=confirmed");
    } else if (action === "cancel") {
      const { error } = await context.callAction(actions.cancelBooking, {
        token,
      });
      if (error) throw error;
      return redirect("/book/confirmed/?status=cancelled");
    }

    return new Response("Invalid action", { status: 400 });
  } catch (error) {
    console.error("Error processing booking:", error);
    return new Response("Failed to process booking", { status: 500 });
  }
};
