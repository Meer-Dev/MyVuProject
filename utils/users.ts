import { createClient } from "./supabase/client";
import type { User } from "@supabase/supabase-js";

const supabase = createClient();

export interface IUserLink {
  id: string;
  label: string;
  url: string;
}

export interface IUser {
  id: string;
  email: string;
  name: string;
  description: string;
  avatar: string;
  created_at?: Date;
  updated_at?: Date;
  links?: IUserLink[];
  provider: "google" | "github" | "email";
}

export const users = {
  async getUser(id: string) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as IUser | null;
  },

  async createUser(user: Partial<IUser>) {
    console.log("Creating user profile:", user);

    try {
      // Use upsert instead of insert - this will update if the record exists
      // or create it if it doesn't
      const { data, error } = await supabase
        .from("users")
        .upsert([user], {
          onConflict: "id",
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        console.error("Error in createUser:", error);
        throw error;
      }

      return data?.[0] as IUser;
    } catch (err) {
      console.error("Exception in createUser:", err);
      throw err;
    }
  },

  // This function attempts to add the user to the users table after auth
  async captureUserDetails(authUser: User) {
    if (!authUser?.id) throw new Error("Invalid auth user");

    try {
      // Wait briefly for trigger to execute
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error || !data) {
        // Fallback manual creation if trigger failed
        const userData = {
          id: authUser.id,
          email: authUser.email || "",
          name:
            authUser.user_metadata?.full_name ||
            authUser.email?.split("@")[0] ||
            "User",
          avatar: authUser.user_metadata?.avatar_url || "",
          description: "",
          provider:
            (authUser.app_metadata?.provider as IUser["provider"]) || "email",
        };

        const { data: newUser, error: createError } = await supabase
          .from("users")
          .upsert(userData)
          .select()
          .single();

        if (createError) throw createError;
        return newUser;
      }

      return data;
    } catch (error) {
      console.error("User capture error:", error);
      throw error;
    }
  },

  async updateUser(id: string, updates: Partial<IUser>) {
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as IUser;
  },

  async updateProfile(
    userId: string,
    updates: Partial<Omit<IUser, "id" | "email" | "provider">>
  ) {
    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;

    // Update auth user metadata if avatar or name changed
    const metadata: { avatar_url?: string; full_name?: string } = {};

    if (updates.avatar !== undefined) {
      metadata.avatar_url = updates.avatar;
    }

    if (updates.name !== undefined) {
      metadata.full_name = updates.name;
    }

    if (Object.keys(metadata).length > 0) {
      const { error: authError } = await supabase.auth.updateUser({
        data: metadata,
      });

      if (authError) {
        console.error("Failed to update auth user metadata:", authError);
      }
    }
  },
};
