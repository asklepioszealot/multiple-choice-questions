import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  window.__APP_SUPABASE__ = Object.freeze({
    createClient,
  });
}
