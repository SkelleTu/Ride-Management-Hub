CREATE TABLE "ride_feedbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"ride_id" integer NOT NULL,
	"reviewer_id" integer NOT NULL,
	"reviewee_id" integer NOT NULL,
	"reviewer_role" text NOT NULL,
	"stars" real NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webauthn_credentials_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "rating" SET DEFAULT 4.6;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "total_ratings" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cpf" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_activated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD COLUMN "is_online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "is_scheduled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "scheduling_type" text;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "directed_to_driver_id" integer;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "scheduled_status" text;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "scheduled_note" text;--> statement-breakpoint
ALTER TABLE "ride_feedbacks" ADD CONSTRAINT "ride_feedbacks_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_feedbacks" ADD CONSTRAINT "ride_feedbacks_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_feedbacks" ADD CONSTRAINT "ride_feedbacks_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_directed_to_driver_id_users_id_fk" FOREIGN KEY ("directed_to_driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;