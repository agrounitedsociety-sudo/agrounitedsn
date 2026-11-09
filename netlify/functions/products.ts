import type { Config } from "@netlify/functions";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";
import { json } from "../../lib/shared.js";

// Public catalogue used by the storefront.
export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Méthode non autorisée" }, 405);
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.position), asc(products.nom));
  const list = rows.map((p) => ({
    id: p.id,
    nom: p.nom,
    cat: p.cat,
    prix: p.prix,
    unite: p.unite,
    vendeur: p.vendeur,
    photo: p.photo,
    desc: p.description,
    details: p.details,
    stock: p.stock,
  }));
  return json(list, 200, { "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
};

export const config: Config = { path: "/api/products" };
