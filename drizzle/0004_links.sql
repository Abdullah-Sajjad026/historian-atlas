CREATE TYPE "public"."link_endpoint_type" AS ENUM('period', 'person', 'event');--> statement-breakpoint
CREATE TYPE "public"."link_kind" AS ENUM('embassy', 'war', 'trade', 'journey', 'transmission');--> statement-breakpoint
CREATE TABLE "links" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "link_kind" NOT NULL,
	"a_type" "link_endpoint_type",
	"a_id" text,
	"a_lat" real,
	"a_lng" real,
	"a_label" text,
	"b_type" "link_endpoint_type",
	"b_id" text,
	"b_lat" real,
	"b_lng" real,
	"b_label" text,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"certainty" date_certainty DEFAULT 'exact' NOT NULL,
	"importance" smallint DEFAULT 3 NOT NULL,
	"summary" text,
	"group_id" text,
	"wikidata_qid" text
);
