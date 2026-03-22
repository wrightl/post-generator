import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";

export const postPlatformEnum = pgEnum("post_platform", [
  "LinkedIn",
  "Skool",
  "Instagram",
  "Bluesky",
  "Facebook",
  "TikTok",
]);

export const postStatusEnum = pgEnum("post_status", [
  "Draft",
  "Scheduled",
  "Published",
  "Failed",
]);

// Users must be defined first (referenced by other tables)
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    externalId: varchar("external_id", { length: 128 }).notNull(),
    email: varchar("email", { length: 256 }).notNull(),
    name: varchar("name", { length: 256 }),
    preferredTheme: varchar("preferred_theme", { length: 10 }),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_external_id_key").on(table.externalId)]
);

export const userSocialCredentials = pgTable(
  "user_social_credentials",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull(),
    credentialJson: varchar("credential_json", { length: 8000 }).notNull().default("{}"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_social_credentials_user_id_platform_key").on(
      table.userId,
      table.platform
    ),
  ]
);

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicSummary: varchar("topic_summary", { length: 500 }),
  platform: postPlatformEnum("platform").notNull(),
  status: postStatusEnum("status").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  externalPostId: varchar("external_post_id", { length: 512 }),
  viewsCount: integer("views_count"),
  likesCount: integer("likes_count"),
  commentsCount: integer("comments_count"),
  lastEngagementFetchedAt: timestamp("last_engagement_fetched_at", {
    withTimezone: true,
  }),
  content: varchar("content", { length: 10000 }).notNull(),
  script: varchar("script", { length: 10000 }),
  imageUrl: varchar("image_url", { length: 2048 }),
  metadataJson: text("metadata_json"),
  tone: varchar("tone", { length: 100 }),
  length: varchar("length", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const postSeries = pgTable("post_series", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicDetail: text("topic_detail").notNull(),
  numPosts: integer("num_posts").notNull(),
  optionsJson: text("options_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const publishLogs = pgTable("publish_logs", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  platform: postPlatformEnum("platform").notNull(),
  succeeded: boolean("succeeded").notNull(),
  errorMessage: varchar("error_message", { length: 2000 }),
  mailgunSentAt: timestamp("mailgun_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSocialCredential = typeof userSocialCredentials.$inferSelect;
export type NewUserSocialCredential = typeof userSocialCredentials.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostSeries = typeof postSeries.$inferSelect;
export type NewPostSeries = typeof postSeries.$inferInsert;
export type PublishLog = typeof publishLogs.$inferSelect;
export type NewPublishLog = typeof publishLogs.$inferInsert;

export type PostPlatform =
  | "LinkedIn"
  | "Skool"
  | "Instagram"
  | "Bluesky"
  | "Facebook"
  | "TikTok";
export type PostStatus = "Draft" | "Scheduled" | "Published" | "Failed";
