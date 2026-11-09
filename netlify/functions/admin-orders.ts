import type { Config, Context } from "@netlify/functions";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders } from "../../db/schema.js";
import { ORDER_STATUSES, json, readJson, requireAdmin, str } from "../../lib/shared.js";

export default async (req: Request, context: Context) => {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = Number(context.params?.id);

  if (!context.params?.id) {
    if (req.method !== "GET") return json({ error: "Méthode non autorisée" }, 405);
    const status = new URL(req.url).searchParams.get("status") || "";
    const base = db.select().from(orders);
    const list = await ((ORDER_STATUSES as readonly string[]).includes(status) ? base.where(eq(orders.status, status)) : base)
      .orderBy(desc(orders.createdAt))
      .limit(500);
    const counts = await db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status);
    return json({ orders: list, counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) });
  }

  if (!Number.isInteger(id)) return json({ error: "Commande introuvable." }, 404);
  if (req.method === "PATCH") {
    const body = await readJson(req);
    if (!body) return json({ error: "Requête invalide." }, 400);
    const patch: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
    if (body.status !== undefined) {
      const s = str(body.status);
      if (!(ORDER_STATUSES as readonly string[]).includes(s)) return json({ error: "Statut inconnu." }, 400);
      patch.status = s;
    }
    if (body.noteAdmin !== undefined) patch.noteAdmin = str(body.noteAdmin, 2000);
    const [row] = await db.update(orders).set(patch).where(eq(orders.id, id)).returning();
    return row ? json(row) : json({ error: "Commande introuvable." }, 404);
  }
  if (req.method === "DELETE") {
    const [row] = await db.delete(orders).where(eq(orders.id, id)).returning({ id: orders.id });
    return row ? json({ ok: true }) : json({ error: "Commande introuvable." }, 404);
  }
  return json({ error: "Méthode non autorisée" }, 405);
};

export const config: Config = { path: ["/api/admin/orders", "/api/admin/orders/:id"] };
