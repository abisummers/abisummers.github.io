import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

export interface BookingData {
  name: string;
  email: string;
  phone?: string;
  date: string;
  time: string;
  duration: number;
  guests: number;
  tour: string;
  message?: string;
  timestamp: number;
  [key: string]: any;
}

export interface StoredBooking {
  bookingData: BookingData;
  token: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "confirmed" | "cancelled";
  used: boolean;
  reminderSent?: boolean;
}

const TOKEN_EXPIRY_HOURS = 48;

const memoryStore = new Map<string, string>();
const isProduction = import.meta.env.PROD || import.meta.env.NETLIFY;

/**
 * Get storage (Netlify Blobs in production, memory in dev)
 */
function getStorage() {
  if (isProduction) {
    return {
      async get(key: string) {
        const store = getStore("bookings");
        return await store.get(key, { type: "text" });
      },
      async set(key: string, value: string) {
        const store = getStore("bookings");
        await store.set(key, value);
      },
    };
  } else {
    return {
      async get(key: string) {
        return memoryStore.get(key) || null;
      },
      async set(key: string, value: string) {
        memoryStore.set(key, value);
      },
    };
  }
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Store booking with secure token in Netlify Blobs
 */
export async function storeBooking(
  bookingData: BookingData,
): Promise<{ bookingId: string; token: string }> {
  const bookingId = generateSecureToken();
  const token = generateSecureToken();

  const now = Date.now();
  const expiresAt = now + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;

  const storedBooking: StoredBooking = {
    bookingData,
    token,
    createdAt: now,
    expiresAt,
    status: "pending",
    used: false,
  };

  const storage = getStorage();
  await storage.set(bookingId, JSON.stringify(storedBooking));

  await storage.set(`token:${token}`, bookingId);

  return { bookingId, token };
}

/**
 * Update booking data (when admin edits before confirming)
 */
export async function updateBooking(
  bookingId: string,
  updatedData: Partial<BookingData>,
): Promise<void> {
  const storage = getStorage();

  const bookingJson = await storage.get(bookingId);
  if (!bookingJson) {
    throw new Error("Booking not found");
  }

  const booking: StoredBooking = JSON.parse(bookingJson);
  booking.bookingData = { ...booking.bookingData, ...updatedData };

  await storage.set(bookingId, JSON.stringify(booking));
}

/**
 * Validate a token and return the booking if valid
 */
export async function validateToken(
  token: string,
): Promise<{ valid: boolean; booking?: StoredBooking; bookingId?: string }> {
  try {
    const storage = getStorage();

    const bookingId = await storage.get(`token:${token}`);

    if (!bookingId) {
      return { valid: false };
    }

    const bookingJson = await storage.get(bookingId);

    if (!bookingJson) {
      return { valid: false };
    }

    const booking: StoredBooking = JSON.parse(bookingJson);

    // Check if already used
    if (booking.used) {
      return { valid: false };
    }

    // Check expiration
    if (Date.now() > booking.expiresAt) {
      return { valid: false };
    }

    // Verify token matches
    if (token !== booking.token) {
      return { valid: false };
    }

    return { valid: true, booking, bookingId };
  } catch (error) {
    console.error("Error validating token:", error);
    return { valid: false };
  }
}

/**
 * Mark a booking as used (confirmed or cancelled - token no longer valid)
 */
export async function markBookingUsed(
  bookingId: string,
  status: "confirmed" | "cancelled",
): Promise<void> {
  const storage = getStorage();

  const bookingJson = await storage.get(bookingId);
  if (!bookingJson) {
    throw new Error("Booking not found");
  }

  const booking: StoredBooking = JSON.parse(bookingJson);
  booking.used = true;
  booking.status = status;

  await storage.set(bookingId, JSON.stringify(booking));
}

/**
 * Mark reminder as sent for a booking
 */
export async function markReminderSent(bookingId: string): Promise<void> {
  const storage = getStorage();

  const bookingJson = await storage.get(bookingId);
  if (!bookingJson) {
    throw new Error("Booking not found");
  }

  const booking: StoredBooking = JSON.parse(bookingJson);
  booking.reminderSent = true;

  await storage.set(bookingId, JSON.stringify(booking));
}

/**
 * Get all bookings (for admin/scheduled tasks)
 * Note: In production with Netlify Blobs, you'll need to implement pagination
 * or maintain a separate index. For MVP, we'll list all.
 */
export async function getAllBookings(): Promise<
  Array<{ bookingId: string; booking: StoredBooking }>
> {
  const storage = getStorage();

  if (!isProduction) {
    // In development, iterate through memory store
    const bookings: Array<{ bookingId: string; booking: StoredBooking }> = [];
    for (const [key, value] of memoryStore.entries()) {
      // Skip token mappings, only process booking IDs
      if (!key.startsWith("token:")) {
        try {
          const booking: StoredBooking = JSON.parse(value);
          bookings.push({ bookingId: key, booking });
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
    return bookings;
  } else {
    // In production with Netlify Blobs
    const store = getStore("bookings");
    const { blobs } = await store.list();

    const bookings: Array<{ bookingId: string; booking: StoredBooking }> = [];

    for (const blob of blobs) {
      // Skip token mappings
      if (blob.key.startsWith("token:")) {
        continue;
      }

      const bookingJson = await store.get(blob.key, { type: "text" });
      if (bookingJson) {
        try {
          const booking: StoredBooking = JSON.parse(bookingJson);
          bookings.push({ bookingId: blob.key, booking });
        } catch (e) {
          // Skip invalid entries
        }
      }
    }

    return bookings;
  }
}
