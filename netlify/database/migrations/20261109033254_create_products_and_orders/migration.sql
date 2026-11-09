CREATE TABLE "orders" (
	"id" serial PRIMARY KEY,
	"reference" text NOT NULL UNIQUE,
	"nom" text NOT NULL,
	"telephone" text NOT NULL,
	"ville" text DEFAULT '' NOT NULL,
	"livraison" text DEFAULT '' NOT NULL,
	"paiement" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"canal" text DEFAULT 'whatsapp' NOT NULL,
	"items" jsonb NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sur_devis" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'nouvelle' NOT NULL,
	"note_admin" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY,
	"nom" text NOT NULL,
	"cat" text NOT NULL,
	"prix" integer DEFAULT 0 NOT NULL,
	"unite" text DEFAULT 'pièce' NOT NULL,
	"vendeur" text DEFAULT 'Agro United' NOT NULL,
	"photo" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"details" jsonb DEFAULT '[]' NOT NULL,
	"stock" integer,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" ("status");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" ("created_at");--> statement-breakpoint
CREATE INDEX "products_cat_idx" ON "products" ("cat");