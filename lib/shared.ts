import { getUser } from "@netlify/identity";

export const CATEGORIES = ["irrigation", "pompage", "outils", "protection", "pepiniere", "stockage", "mesure"] as const;
export const ORDER_STATUSES = ["nouvelle", "confirmee", "livree", "annulee"] as const;

const DEFAULT_ADMINS = "agrounitedsociety@gmail.com";

export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || DEFAULT_ADMINS;
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  return !!email && adminEmails().includes(email.trim().toLowerCase());
}

/** Returns a Response to send back if the caller isn't an admin, or null if access is granted. */
export async function requireAdmin(): Promise<Response | null> {
  const user = await getUser();
  if (!user) return json({ error: "Connexion requise." }, 401);
  const roles = (user as { roles?: string[] }).roles || [];
  if (!roles.includes("admin") && !isAdminEmail(user.email)) {
    return json({ error: "Accès réservé aux administrateurs." }, 403);
  }
  return null;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });

export const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const int = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
};

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
