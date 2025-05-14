import { useAccessStore } from "@/stores/useAccessStore";
import { createClient } from "./supabase/client";
import { users } from "./users";

const supabase = createClient();

export type AuthError = {
  message: string;
  status?: number;
};

export const auth = {
  // Email & Password Sign Up
  async signUp(email: string, password: string) {
    console.log("Beginning signup process for:", email);

    try {
      // Step 1: Sign up the user with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
          data: {
            full_name: email.split("@")[0], // Default name from email
          },
        },
      });

      // If signup fails
      if (signUpError) {
        console.error("Auth signup error:", signUpError);
        throw signUpError;
      }

      // If no user data, something went wrong
      if (!data?.user) {
        console.error("No user data returned from signup");
        throw new Error("Failed to create user account");
      }

      console.log("Auth user created successfully:", data.user.id);

      // Step 2: Create user profile in users table
      try {
        const userProfile = await users.captureUserDetails(data.user);
        console.log("User profile created:", userProfile);
      } catch (profileError: any) {
        console.error("Profile creation error:", profileError);
        // We don't delete the auth user here, as that might cause more issues
        // Just report the error to the user
        throw new Error(
          `Account created but profile setup failed: ${profileError.message || "Unknown error"}`
        );
      }

      return data;
    } catch (error) {
      console.error("Signup process error:", error);
      throw error;
    }
  },

  // Email & Password Sign In
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        throw error;
      }

      if (data.user) {
        try {
          await users.captureUserDetails(data.user);
        } catch (profileError) {
          console.error("Profile capture error during signin:", profileError);
          // Continue anyway since the user is authenticated
        }
      }

      return data;
    } catch (error) {
      console.error("Sign in process error:", error);
      throw error;
    }
  },

  // OAuth Sign In (Google, GitHub)
  async signInWithOAuth(provider: "github" | "google", nextUrl?: string) {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/callback?next=${nextUrl || "/"}`,
        },
      });

      if (error) {
        console.error("OAuth sign in error:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("OAuth sign in process error:", error);
      throw error;
    }
  },

  // Sign Out
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      useAccessStore.getState().reset();

      if (error) {
        console.error("Sign out error:", error);
        throw { message: error.message, status: error.status };
      }
    } catch (error) {
      console.error("Sign out process error:", error);
      throw error;
    }
  },

  // Password Reset Request
  async resetPasswordRequest(email: string) {
    try {
      // First check if user exists in our users table and uses email provider
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, provider")
        .eq("email", email)
        .single();

      if (userError && userError.code !== "PGRST116") {
        // PGRST116 means no rows returned
        console.error("Error checking user for password reset:", userError);
        throw userError;
      }

      // If user doesn't exist or doesn't use email auth, still return success
      // This prevents email enumeration attacks
      if (!user || user.provider !== "email") {
        return {
          success: true,
          message: "If an account exists, a password reset link will be sent.",
        };
      }

      const resetLink = `${location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetLink,
      });

      if (error) {
        console.error("Password reset request error:", error);
        throw error;
      }

      return {
        success: true,
        message: "If an account exists, a password reset link will be sent.",
      };
    } catch (error) {
      console.error("Password reset request process error:", error);
      throw error;
    }
  },

  // Password Reset
  async resetPassword(newPassword: string) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("Password reset error:", error);
        throw { message: error.message, status: error.status };
      }

      return data;
    } catch (error) {
      console.error("Password reset process error:", error);
      throw error;
    }
  },
};
