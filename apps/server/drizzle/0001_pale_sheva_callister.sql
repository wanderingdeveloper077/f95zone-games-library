ALTER TABLE `game_metadata` ADD `gallery_files_json` text DEFAULT '[]' NOT NULL;

--> statement-breakpoint
UPDATE `game_metadata` SET `expires_at_ms` = 0 WHERE `expires_at_ms` IS NOT NULL;
