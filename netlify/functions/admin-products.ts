import type { Config, Context } from "@netlify/functions";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";
import { CATEGORIES, int, json, readJson, requireAdmin, str } from "../../lib/shared.js";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function parseProduct(body: Record<string, unknown>) {
  const nom = str(body.nom, 160);
  const cat = str(body.cat, 40);
  if (!nom) return { error: "Le nom du produit est obligatoire." };
  if (!(CATEGORIES as readonly string[]).includes(cat)) return { error: "Catégorie inconnue." };
  const photo = str(body.photo, 1000);
  if (photo && !/^(https?:\/\/|\/)/.test(photo)) return { error: "La photo doit être un lien commençant par https:// ou /." };
  const details = Array.isArray(body.details)
    ? body.details.map((d) => str(d, 300)).filter(Boolean).slice(0, 20)
    : str(body.details, 5000).split("\n").map((d) => d.trim()).filter(Boolean).slice(0, 20);
  const stockRaw = body.stock;
  const stock = stockRaw === null || stockRaw === "" || stockRaw === undefined ? null : int(stockRaw);
  return {
    value: {
      nom,
      cat,
      prix: int(body.prix) ?? 0,
      unite: str(body.unite, 80) || "pièce",
      vendeur: str(body.vendeur, 120) || "Agro United",
      photo,
      description: str(body.description, 2000),
      details,
      stock,
      active: body.active !== false,
      position: int(body.position) ?? 0,
    },
  };
}

export default async (req: Request, context: Context) => {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = context.params?.id;

  if (!id) {
    if (req.method === "GET") {
      return json(await db.select().from(products).orderBy(asc(products.position), asc(products.nom)));
    }
    if (req.method === "POST") {
      const body = await readJson(req);
      if (!body) return json({ error: "Requête invalide." }, 400);
      const parsed = parseProduct(body);
      if ("error" in parsed) return json({ error: parsed.error }, 400);
      let newId = slugify(str(body.id, 60) || parsed.value.nom) || "produit";
      const [taken] = await db.select({ id: products.id }).from(products).where(eq(products.id, newId));
      if (taken) newId = `${newId}-${Date.now().toString(36).slice(-4)}`;
      if (!parsed.value.position) {
        const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${products.position}), 0)` }).from(products);
        parsed.value.position = Number(max) + 10;
      }
      const [row] = await db.insert(products).values({ id: newId, ...parsed.value }).returning();
      return json(row, 201);
    }
    return json({ error: "Méthode non autorisée" }, 405);
  }

  if (req.method === "PUT") {
    const body = await readJson(req);
    if (!body) return json({ error: "Requête invalide." }, 400);
    const parsed = parseProduct(body);
    if ("error" in parsed) return json({ error: parsed.error }, 400);
    const [row] = await db
      .update(products)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return row ? json(row) : json({ error: "Produit introuvable." }, 404);
  }
  if (req.method === "DELETE") {
    const [row] = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    return row ? json({ ok: true }) : json({ error: "Produit introuvable." }, 404);
  }
  return json({ error: "Méthode non autorisée" }, 405);
};

export const config: Config = { path: ["/api/admin/products", "/api/admin/products/:id"] };
