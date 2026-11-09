import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { json, requireAdmin } from "../../lib/shared.js";

// Lets the dashboard check whether the logged-in user is allowed in.
export default async () => {
  const denied = await requireAdmin();
  if (denied) return denied;
  const user = await getUser();
  return json({ email: user?.email });
};

export const config: Config = { path: "/api/admin/me" };
