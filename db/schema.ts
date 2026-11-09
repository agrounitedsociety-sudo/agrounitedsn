import { pgTable, serial, text, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export type OrderItem = {
  productId: string;
  nom: string;
  unite: string;
  vendeur: string;
  prix: number; // unit price in FCFA at order time (0 = on quote)
  quantite: number;
};

export const products = pgTable(
  "products",
  {
    id: text().primaryKey(), // slug, e.g. "kit-gag-1000"
    nom: text().notNull(),
    cat: text().notNull(),
    prix: integer().notNull().default(0), // FCFA, 0 = "Prix sur demande"
    unite: text().notNull().default("pièce"),
    vendeur: text().notNull().default("Agro United"),
    photo: text().notNull().default(""),
    description: text().notNull().default(""),
    details: jsonb().$type<string[]>().notNull().default([]),
    stock: integer(), // null = not tracked, 0 = out of stock
    active: boolean().notNull().default(true),
    position: integer().notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_cat_idx").on(t.cat)],
);

export const orders = pgTable(
  "orders",
  {
    id: serial().primaryKey(),
    reference: text().notNull().unique(),
    nom: text().notNull(),
    telephone: text().notNull(),
    ville: text().notNull().default(""),
    livraison: text().notNull().default(""),
    paiement: text().notNull().default(""),
    message: text().notNull().default(""),
    canal: text().notNull().default("whatsapp"), // whatsapp | email
    items: jsonb().$type<OrderItem[]>().notNull(),
    total: integer().notNull().default(0),
    surDevis: boolean("sur_devis").notNull().default(false),
    status: text().notNull().default("nouvelle"), // nouvelle | confirmee | livree | annulee
    noteAdmin: text("note_admin").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_status_idx").on(t.status), index("orders_created_idx").on(t.createdAt)],
);
