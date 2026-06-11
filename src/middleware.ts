import { defineMiddleware } from "astro:middleware";

/**
 * HTTP Basic Auth for the manual-booking admin page.
 *
 * Protects /book/manual* with credentials from the ADMIN_USER and
 * ADMIN_PASSWORD environment variables. The createManualBooking action
 * additionally checks ADMIN_PASSWORD itself, so the action endpoint stays
 * protected even though browsers don't reliably forward Basic Auth
 * credentials to the /_actions/ route.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname.startsWith("/book/manual")) {
    const user = import.meta.env.ADMIN_USER;
    const password = import.meta.env.ADMIN_PASSWORD;

    if (!user || !password) {
      return new Response("Admin credentials are not configured", {
        status: 500,
      });
    }

    const expected =
      "Basic " + Buffer.from(`${user}:${password}`).toString("base64");

    if (context.request.headers.get("authorization") !== expected) {
      return new Response("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate":
            'Basic realm="Abi Summers admin", charset="UTF-8"',
        },
      });
    }
  }

  return next();
});
