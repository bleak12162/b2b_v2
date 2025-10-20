CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE "CompanyType" AS ENUM ('ORDERER', 'FARMER');
CREATE TYPE "UserRole" AS ENUM ('ORDERER_ADMIN', 'ORDERER_STAFF', 'FARMER_ADMIN', 'FARMER_STAFF');
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELED');
CREATE TYPE "InventoryMovementType" AS ENUM ('ADJUSTMENT', 'ALLOCATE', 'DEALLOCATE', 'SHIP');

-- Companies
CREATE TABLE "Company" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "CompanyType" NOT NULL,
    "code" TEXT UNIQUE,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Company_type_idx" ON "Company" ("type");

-- Users
CREATE TABLE "User" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE RESTRICT,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE "Product" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "farmerId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE RESTRICT,
    "name" TEXT NOT NULL,
    "sku" TEXT UNIQUE,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "unitPrice" NUMERIC(12, 2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Product_farmerId_isActive_idx" ON "Product" ("farmerId", "isActive");

-- Product special prices
CREATE TABLE "ProductSpecialPrice" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ,
    "price" NUMERIC(12, 2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ProductSpecialPrice_productId_startAt_endAt_idx" ON "ProductSpecialPrice" ("productId", "startAt", "endAt");

-- ShipTo master
CREATE TABLE "ShipTo" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "label" TEXT NOT NULL,
    "postalCode" TEXT,
    "address" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "ShipTo_companyId_label_unique" UNIQUE ("companyId", "label")
);

CREATE TABLE "ShipToFarmerRoute" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "shipToId" TEXT NOT NULL REFERENCES "ShipTo"("id") ON DELETE CASCADE,
    "farmerCompanyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "ShipToFarmerRoute_shipToId_farmerCompanyId_unique" UNIQUE ("shipToId", "farmerCompanyId")
);

-- Orders
CREATE TABLE "Order" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderCode" TEXT NOT NULL UNIQUE,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "ordererCompanyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE RESTRICT,
    "farmerCompanyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE RESTRICT,
    "orderedById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "discountAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "totalAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    "orderedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "requestedDelivery" TIMESTAMPTZ,
    "notes" TEXT,
    "confirmedAt" TIMESTAMPTZ,
    "shippedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "canceledAt" TIMESTAMPTZ,
    "trackingNumber" TEXT,
    "shipToId" TEXT REFERENCES "ShipTo"("id") ON DELETE SET NULL,
    "shipToLabelSnap" TEXT,
    "shipToAddressSnap" TEXT,
    "shipToPhoneSnap" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order items
CREATE TABLE "OrderItem" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
    "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
    "productNameSnap" TEXT NOT NULL,
    "productSkuSnap" TEXT,
    "unit" TEXT NOT NULL,
    "quantity" NUMERIC(10, 2) NOT NULL,
    "unitPrice" NUMERIC(12, 2) NOT NULL,
    "totalPrice" NUMERIC(12, 2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem" ("orderId");

-- Inventory ledger
CREATE TABLE "InventoryLedger" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
    "farmerCompanyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE RESTRICT,
    "orderId" TEXT REFERENCES "Order"("id") ON DELETE SET NULL,
    "orderItemId" TEXT REFERENCES "OrderItem"("id") ON DELETE SET NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "quantity" NUMERIC(10, 2) NOT NULL,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "InventoryLedger_productId_occurredAt_idx" ON "InventoryLedger" ("productId", "occurredAt");
CREATE INDEX "InventoryLedger_orderId_idx" ON "InventoryLedger" ("orderId");

-- User settings
CREATE TABLE "UserSetting" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
    "lineUserId" TEXT,
    "lineEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "notificationFlags" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: keep Order.totalAmount in sync with OrderItem totals
CREATE OR REPLACE FUNCTION recalc_order_total() RETURNS TRIGGER AS $$
DECLARE
    target_order_id TEXT;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_order_id := OLD."orderId";
    ELSE
        target_order_id := NEW."orderId";
    END IF;

    UPDATE "Order"
    SET "totalAmount" = COALESCE((
        SELECT SUM("totalPrice") FROM "OrderItem" WHERE "orderId" = target_order_id
    ), 0) - COALESCE((
        SELECT "discountAmount" FROM "Order" WHERE "id" = target_order_id
    ), 0)
    WHERE "id" = target_order_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_item_after_write
AFTER INSERT OR UPDATE ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION recalc_order_total();

CREATE TRIGGER order_item_after_delete
AFTER DELETE ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION recalc_order_total();

CREATE TRIGGER order_after_discount_change
AFTER UPDATE OF "discountAmount" ON "Order"
FOR EACH ROW EXECUTE FUNCTION recalc_order_total();

-- Trigger to maintain updatedAt columns
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_touch_updated_at
BEFORE UPDATE ON "Company"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER user_touch_updated_at
BEFORE UPDATE ON "User"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER product_touch_updated_at
BEFORE UPDATE ON "Product"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER product_special_price_touch_updated_at
BEFORE UPDATE ON "ProductSpecialPrice"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER ship_to_touch_updated_at
BEFORE UPDATE ON "ShipTo"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER order_touch_updated_at
BEFORE UPDATE ON "Order"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER order_item_touch_updated_at
BEFORE UPDATE ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER inventory_ledger_touch_updated_at
BEFORE UPDATE ON "InventoryLedger"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER user_setting_touch_updated_at
BEFORE UPDATE ON "UserSetting"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
