-- AlterTable
ALTER TABLE "orders" ADD COLUMN "delivery_method" TEXT,
ADD COLUMN "shipping_cost" INTEGER,
ADD COLUMN "scheduled_date" TIMESTAMPTZ,
ADD COLUMN "mu_uuid" TEXT,
ADD COLUMN "mu_task_id" INTEGER,
ADD COLUMN "mu_status" TEXT,
ADD COLUMN "mu_driver_name" TEXT,
ADD COLUMN "mu_driver_phone" TEXT,
ADD COLUMN "mu_driver_plate" TEXT,
ADD COLUMN "mu_tracking_url" TEXT,
ADD COLUMN "mu_eta" TEXT;

-- CreateTable
CREATE TABLE "delivery_settings" (
    "id" UUID NOT NULL,
    "city" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mu_access_token" TEXT NOT NULL,
    "mu_webhook_token" TEXT NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "pickup_city" TEXT NOT NULL,
    "pickup_store_id" TEXT NOT NULL,
    "pickup_store_name" TEXT NOT NULL,
    "pickup_phone" TEXT NOT NULL,
    "time_slots" JSONB NOT NULL DEFAULT '[]',
    "available_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "delivery_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_settings_city_key" ON "delivery_settings"("city");
