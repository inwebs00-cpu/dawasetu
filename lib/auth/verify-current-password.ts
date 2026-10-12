import "server-only";

import { createClient } from "@supabase/supabase-js";

export async function verifyCurrentPassword(email: string, password: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey || password.length < 12) return false;

  const verifier = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  await verifier.auth.signOut();
  return !error;
}
