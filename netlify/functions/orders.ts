import type { Config } from "@netlify/functions";
import { inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders, products, type OrderItem } from "../../db/schema.js";
import { int, json, readJson, str } from "../../lib/shared.js";

const REF_RE = /^AU-[0-9]{6}-[A-Z0-9]{4}$/;

// Public endpoint: records an order placed from the storefront before it is sent via WhatsApp or e-mail.
export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const body = await readJson(req);
  if (!body) return json({ error: "Requête invalide." }, 400);
  if (str(body["bot-field"])) return json({ ok: true }, 201); // honeypot

  const nom = str(body.nom, 120);
  const telephone = str(body.telephone, 40);
  if (!nom || !telephone) return json({ error: "Nom et téléphone obligatoires." }, 400);

  const reference = str(body.reference, 20).toUpperCase();
  if (!REF_RE.test(reference)) return json({ error: "Référence invalide." }, 400);

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    const id = str((it as Record<string, unknown>)?.id, 80);
    const q = int((it as Record<string, unknown>)?.quantite);
    if (id && q && q > 0) wanted.set(id, Math.min((wanted.get(id) || 0) + q, 10000));
  }
  if (!wanted.size) return json({ error: "Le panier est vide." }, 400);

  // Prices come from the database, never from the client.
  const found = await db.select().from(products).where(inArray(products.id, [...wanted.keys()]));
  const items: OrderItem[] = found.map((p) => ({
    productId: p.id,
    nom: p.nom,
    unite: p.unite,
    vendeur: p.vendeur,
    prix: p.prix,
    quantite: wanted.get(p.id)!,
  }));
  if (!items.length) return json({ error: "Produits introuvables." }, 400);

  const total = items.reduce((s, i) => s + i.prix * i.quantite, 0);
  const surDevis = items.some((i) => !i.prix);
  const canal = str(body.canal) === "email" ? "email" : "whatsapp";

  const [row] = await db
    .insert(orders)
    .values({
      reference,
      nom,
      telephone,
      ville: str(body.ville, 120),
      livraison: str(body.livraison, 120),
      paiement: str(body.paiement, 60),
      message: str(body.message, 2000),
      canal,
      items,
      total,
      surDevis,
    })
    .onConflictDoNothing({ target: orders.reference })
    .returning({ id: orders.id, reference: orders.reference });

  return json({ ok: true, reference: row?.reference || reference }, 201);
};

export const config: Config = { path: "/api/orders" };
