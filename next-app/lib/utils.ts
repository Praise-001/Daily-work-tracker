/** Strip characters that could cause XSS and enforce a maximum length. */
export function sanitizeText(input: string, maxLen: number): string {
  return input
    .trim()
    .replace(/[<>"'`]/g, "")
    .slice(0, maxLen);
}

/**
 * Generate a cryptographically random invite code.
 * Uses base62 alphabet (a-z A-Z 0-9) for URL-safety.
 * Result is always at least 8 characters.
 */
export function generateInviteCode(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

/** Convert a Firebase Auth error message to something user-friendly. */
export function cleanFirebaseError(message: string): string {
  if (message.includes("user-not-found") || message.includes("wrong-password") || message.includes("invalid-credential"))
    return "Incorrect email or password.";
  if (message.includes("email-already-in-use"))
    return "An account with this email already exists.";
  if (message.includes("weak-password"))
    return "Password must be at least 6 characters.";
  if (message.includes("invalid-email"))
    return "Please enter a valid email address.";
  if (message.includes("too-many-requests"))
    return "Too many attempts. Please try again later.";
  if (message.includes("network-request-failed"))
    return "Network error. Check your connection and try again.";
  if (message.includes("popup-closed-by-user"))
    return "Sign-in popup was closed. Please try again.";
  return "Something went wrong. Please try again.";
}

/** Format a YYYY-MM-DD date string into { day: "Mon", date: "Mar 21" } */
export function formatDate(dateStr: string): { day: string; date: string } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    day: d.toLocaleDateString("en-US", { weekday: "short" }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

/** Format a number as a locale currency string (no currency code prefix — caller adds symbol). */
export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
