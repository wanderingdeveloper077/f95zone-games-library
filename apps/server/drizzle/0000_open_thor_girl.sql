CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`user_agent` text,
	`encrypted_payload` text DEFAULT '' NOT NULL,
	`cookie_count` integer DEFAULT 0 NOT NULL,
	`has_xf_user` integer DEFAULT false NOT NULL,
	`has_cf_clearance` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'unconfigured' NOT NULL,
	`last_verified_at_ms` integer,
	`updated_at_ms` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`use_cache_api_fallback` integer DEFAULT true NOT NULL,
	`cache_api_url` text DEFAULT 'https://api.f95checker.dev' NOT NULL,
	`scrape_delay_ms` integer DEFAULT 1000 NOT NULL,
	`ext_icon_glow` integer DEFAULT true NOT NULL,
	`ext_highlight_tags` integer DEFAULT true NOT NULL,
	`tag_highlights_json` text DEFAULT '{}' NOT NULL,
	`updated_at_ms` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_metadata` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`votes` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`changelog` text DEFAULT '' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`unknown_tags_json` text DEFAULT '[]' NOT NULL,
	`unknown_tags_flag` integer DEFAULT false NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`previews_urls_json` text DEFAULT '[]' NOT NULL,
	`downloads_json` text DEFAULT '[]' NOT NULL,
	`reviews_total` integer DEFAULT 0 NOT NULL,
	`reviews_json` text DEFAULT '[]' NOT NULL,
	`content_hash` text DEFAULT '' NOT NULL,
	`last_error` text,
	`next_retry_at_ms` integer,
	`expires_at_ms` integer,
	`updated_at_ms` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY NOT NULL,
	`custom` integer DEFAULT false NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`version` text DEFAULT 'Unchecked' NOT NULL,
	`developer` text DEFAULT '' NOT NULL,
	`type` integer DEFAULT 23 NOT NULL,
	`status` integer DEFAULT 5 NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`installed_version` text DEFAULT '' NOT NULL,
	`finished_version` text DEFAULT '' NOT NULL,
	`has_update` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`rating` real DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`executables_json` text DEFAULT '[]' NOT NULL,
	`added_at_ms` integer DEFAULT 0 NOT NULL,
	`last_updated_ts_sec` integer DEFAULT 0 NOT NULL,
	`last_checked_at_ms` integer DEFAULT 0 NOT NULL,
	`last_launched_at_ms` integer DEFAULT 0 NOT NULL,
	`playtime_sec` real DEFAULT 0 NOT NULL,
	`cover_file` text
);
--> statement-breakpoint
CREATE TABLE `index_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`error_summary` text,
	`created_at_ms` integer NOT NULL,
	`started_at_ms` integer,
	`finished_at_ms` integer
);
