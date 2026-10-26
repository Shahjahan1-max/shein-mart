CREATE TABLE `admin_activity_marks` (
  `kind` text NOT NULL,
  `ref_id` integer NOT NULL,
  `seen` integer DEFAULT 0 NOT NULL,
  `hidden` integer DEFAULT 0 NOT NULL,
  `seen_upto` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (`kind`, `ref_id`)
);
