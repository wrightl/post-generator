CREATE TYPE "public"."post_platform" AS ENUM('LinkedIn', 'Skool', 'Instagram', 'Bluesky', 'Facebook', 'TikTok');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('Draft', 'Scheduled', 'Published', 'Failed');--> statement-breakpoint
CREATE TABLE "post_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"topic_detail" text NOT NULL,
	"num_posts" integer NOT NULL,
	"options_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"topic_summary" varchar(500),
	"platform" "post_platform" NOT NULL,
	"status" "post_status" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"external_post_id" varchar(512),
	"views_count" integer,
	"likes_count" integer,
	"comments_count" integer,
	"last_engagement_fetched_at" timestamp with time zone,
	"content" varchar(10000) NOT NULL,
	"script" varchar(10000),
	"image_url" varchar(2048),
	"metadata_json" text,
	"tone" varchar(100),
	"length" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"platform" "post_platform" NOT NULL,
	"succeeded" boolean NOT NULL,
	"error_message" varchar(2000),
	"mailgun_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_social_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" varchar(32) NOT NULL,
	"credential_json" varchar(8000) DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar(128) NOT NULL,
	"email" varchar(256) NOT NULL,
	"name" varchar(256),
	"preferred_theme" varchar(10),
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_series" ADD CONSTRAINT "post_series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_logs" ADD CONSTRAINT "publish_logs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_social_credentials" ADD CONSTRAINT "user_social_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_social_credentials_user_id_platform_key" ON "user_social_credentials" USING btree ("user_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_id_key" ON "users" USING btree ("external_id");