// utils/auth-errors.ts

// Define common authentication error types and messages
type ErrorWithMessage = {
  message: string;
  status?: number;
  code?: string;
  details?: string;
};

export function getAuthError(error: unknown): {
  message: string;
  status?: number;
} {
  // Default error message
  let message = "An unexpected error occurred";
  let status: number | undefined = undefined;

  if (!error) {
    return { message, status };
  }

  console.error("Auth error details:", error);

  // Try to cast to a known error type
  const err = error as ErrorWithMessage;

  if (err.message) {
    message = err.message;
    status = err.status;

    // Check for Supabase specific errors
    if (err.code) {
      switch (err.code) {
        case "23505": // Postgres unique constraint violation
          message =
            "This email is already registered. Please try logging in instead.";
          break;
        case "auth/email-already-in-use":
        case "email-already-in-use":
          message =
            "This email is already in use. Please try logging in instead.";
          break;
        case "auth/invalid-email":
          message = "The email address is invalid.";
          break;
        case "auth/weak-password":
          message = "Password is too weak. Please use at least 6 characters.";
          break;
        case "auth/user-not-found":
          message = "No account found with this email address.";
          break;
        case "auth/wrong-password":
          message = "Incorrect password. Please try again.";
          break;
        case "user-not-found":
          message = "Account not found. Please check your email address.";
          break;
        // Add more specific error codes as needed
      }
    }

    // Make more user-friendly error messages for common cases
    if (
      message.includes("duplicate key") ||
      message.includes("already registered") ||
      message.includes("already in use") ||
      message.includes("already exists")
    ) {
      message =
        "This email is already registered. Please try logging in instead.";
    } else if (
      message.toLowerCase().includes("invalid login") ||
      message.toLowerCase().includes("invalid credentials")
    ) {
      message = "Incorrect email or password. Please try again.";
    } else if (message.includes("email") && message.includes("confirmation")) {
      message =
        "Please check your email to confirm your account before logging in.";
    } else if (
      message.toLowerCase().includes("permission") ||
      message.toLowerCase().includes("not authorized") ||
      message.toLowerCase().includes("rls") ||
      message.toLowerCase().includes("policy")
    ) {
      message =
        "Account creation failed due to permission issues. Please contact support.";
    } else if (
      message.toLowerCase().includes("constraint") ||
      message.toLowerCase().includes("foreign key")
    ) {
      message =
        "Account creation failed due to database constraints. Please try again or contact support.";
    }
  }

  return { message, status };
}
