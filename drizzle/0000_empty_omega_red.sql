CREATE TYPE "public"."date_certainty" AS ENUM('exact', 'circa', 'disputed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."period_kind" AS ENUM('dynasty', 'empire', 'caliphate', 'kingdom', 'republic', 'era');--> statement-breakpoint
CREATE TYPE "public"."person_role" AS ENUM('ruler', 'scholar', 'general', 'artist', 'prophet', 'philosopher', 'explorer', 'founder');--> statement-breakpoint
CREATE TYPE "public"."theme_entity_type" AS ENUM('period', 'person', 'event');--> statement-breakpoint
CREATE TABLE "event_periods" (
	"event_id" text NOT NULL,
	"period_id" text NOT NULL,
	CONSTRAINT "event_periods_event_id_period_id_pk" PRIMARY KEY("event_id","period_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"certainty" date_certainty DEFAULT 'exact' NOT NULL,
	"year_range" "int4range",
	"region" text NOT NULL,
	"importance" smallint DEFAULT 3 NOT NULL,
	"summary" text,
	"wikidata_qid" text,
	"enrichment" jsonb,
	"enriched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"birth_year" integer,
	"death_year" integer,
	"birth_certainty" date_certainty DEFAULT 'exact' NOT NULL,
	"death_certainty" date_certainty DEFAULT 'exact' NOT NULL,
	"life_range" "int4range",
	"importance" smallint DEFAULT 3 NOT NULL,
	"influence" text,
	"summary" text,
	"wikidata_qid" text,
	"enrichment" jsonb,
	"enriched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "period_people" (
	"period_id" text NOT NULL,
	"person_id" text NOT NULL,
	"role" "person_role" NOT NULL,
	CONSTRAINT "period_people_period_id_person_id_role_pk" PRIMARY KEY("period_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "period_kind" NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"start_certainty" date_certainty DEFAULT 'exact' NOT NULL,
	"end_certainty" date_certainty DEFAULT 'exact' NOT NULL,
	"year_range" "int4range",
	"region" text NOT NULL,
	"parent_id" text,
	"importance" smallint DEFAULT 3 NOT NULL,
	"summary" text,
	"wikidata_qid" text,
	"enrichment" jsonb,
	"enriched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "theme_memberships" (
	"theme_id" text NOT NULL,
	"entity_type" "theme_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	CONSTRAINT "theme_memberships_theme_id_entity_type_entity_id_pk" PRIMARY KEY("theme_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"calendar_mode" text DEFAULT 'gregorian' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_periods" ADD CONSTRAINT "event_periods_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_periods" ADD CONSTRAINT "event_periods_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_people" ADD CONSTRAINT "period_people_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_people" ADD CONSTRAINT "period_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_memberships" ADD CONSTRAINT "theme_memberships_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_region_idx" ON "events" USING btree ("region");--> statement-breakpoint
CREATE INDEX "people_importance_idx" ON "people" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "periods_region_idx" ON "periods" USING btree ("region");--> statement-breakpoint
CREATE INDEX "periods_importance_idx" ON "periods" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "theme_memberships_entity_idx" ON "theme_memberships" USING btree ("entity_type","entity_id");