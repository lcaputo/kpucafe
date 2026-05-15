-- CreateEnum
CREATE TYPE "order_source" AS ENUM ('web', 'whatsapp');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "source" "order_source" NOT NULL DEFAULT 'web';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "registration_complete" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "password_hash" SET DEFAULT '';
