ALTER TABLE "events" ADD COLUMN "lat" real;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "lng" real;--> statement-breakpoint
ALTER TABLE "periods" ADD COLUMN "center_lat" real;--> statement-breakpoint
ALTER TABLE "periods" ADD COLUMN "center_lng" real;--> statement-breakpoint
ALTER TABLE "periods" ADD COLUMN "influence_km" integer;