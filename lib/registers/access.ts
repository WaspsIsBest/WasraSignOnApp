import { createClient } from "@/lib/supabase/client";
import type { AccessArea, AccessLevel } from "./types";

export async function getRegisterAccess(kind: AccessArea): Promise<AccessLevel> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("register_access_level", { p_register: kind });
  if (error || (data !== "view" && data !== "edit")) return "none";
  return data;
}
