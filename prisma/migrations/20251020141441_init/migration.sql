-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lineUserId" TEXT,
    CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmerCompanyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '個',
    "isManaged" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_farmerCompanyId_fkey" FOREIGN KEY ("farmerCompanyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductSpecialPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "validFrom" DATETIME NOT NULL,
    "validTo" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductSpecialPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordererCompanyId" TEXT NOT NULL,
    "farmerCompanyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "shipToId" TEXT,
    "shipToLabel" TEXT,
    "shipToAddress" TEXT,
    "shipToPhone" TEXT,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "trackingNo" TEXT,
    "shippedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Order_ordererCompanyId_fkey" FOREIGN KEY ("ordererCompanyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipTo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordererCompanyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShipTo_ordererCompanyId_fkey" FOREIGN KEY ("ordererCompanyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipToFarmerRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipToId" TEXT NOT NULL,
    "farmerCompanyId" TEXT NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShipToFarmerRoute_shipToId_fkey" FOREIGN KEY ("shipToId") REFERENCES "ShipTo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShipToFarmerRoute_farmerCompanyId_fkey" FOREIGN KEY ("farmerCompanyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Company_type_idx" ON "Company"("type");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSetting_userId_key" ON "UserSetting"("userId");

-- CreateIndex
CREATE INDEX "UserSetting_lineUserId_idx" ON "UserSetting"("lineUserId");

-- CreateIndex
CREATE INDEX "Product_farmerCompanyId_idx" ON "Product"("farmerCompanyId");

-- CreateIndex
CREATE INDEX "ProductSpecialPrice_productId_idx" ON "ProductSpecialPrice"("productId");

-- CreateIndex
CREATE INDEX "ProductSpecialPrice_validFrom_validTo_idx" ON "ProductSpecialPrice"("validFrom", "validTo");

-- CreateIndex
CREATE INDEX "Order_ordererCompanyId_idx" ON "Order"("ordererCompanyId");

-- CreateIndex
CREATE INDEX "Order_farmerCompanyId_idx" ON "Order"("farmerCompanyId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "InventoryLedger_orderId_idx" ON "InventoryLedger"("orderId");

-- CreateIndex
CREATE INDEX "InventoryLedger_productId_idx" ON "InventoryLedger"("productId");

-- CreateIndex
CREATE INDEX "InventoryLedger_createdAt_idx" ON "InventoryLedger"("createdAt");

-- CreateIndex
CREATE INDEX "ShipTo_ordererCompanyId_idx" ON "ShipTo"("ordererCompanyId");

-- CreateIndex
CREATE INDEX "ShipToFarmerRoute_shipToId_idx" ON "ShipToFarmerRoute"("shipToId");

-- CreateIndex
CREATE INDEX "ShipToFarmerRoute_farmerCompanyId_idx" ON "ShipToFarmerRoute"("farmerCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipToFarmerRoute_shipToId_farmerCompanyId_key" ON "ShipToFarmerRoute"("shipToId", "farmerCompanyId");
