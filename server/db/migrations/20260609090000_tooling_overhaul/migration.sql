ALTER TABLE "ToolingRecord" ADD COLUMN "toolingNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ToolingRecord" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'injection-mold';
ALTER TABLE "ToolingRecord" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "ToolingRecord" ADD COLUMN "leadTimeDays" INTEGER;
