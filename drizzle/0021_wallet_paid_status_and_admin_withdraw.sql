ALTER TABLE wallet_transactions ADD COLUMN payment_reference TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE wallet_transactions ADD COLUMN paid_at INTEGER;
