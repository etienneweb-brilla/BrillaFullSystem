-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "serviceType" TEXT,
    "priceList" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LaundryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "clientPrice" REAL NOT NULL DEFAULT 0,
    "supplierCost" REAL NOT NULL DEFAULT 0,
    "internalCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LaundryBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "fulfilmentMode" TEXT NOT NULL DEFAULT 'outsourced',
    "supplierId" TEXT,
    "driverStaffId" TEXT,
    "workOrderId" TEXT,
    "collectionDate" DATETIME,
    "returnDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LaundryBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LaundryBatch_driverStaffId_fkey" FOREIGN KEY ("driverStaffId") REFERENCES "StaffProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LaundryBatch_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaundryBatchItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "propertyId" TEXT,
    "laundryItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "collectedQty" INTEGER NOT NULL DEFAULT 0,
    "returnedQty" INTEGER NOT NULL DEFAULT 0,
    "damagedQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LaundryBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LaundryBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LaundryBatchItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LaundryBatchItem_laundryItemId_fkey" FOREIGN KEY ("laundryItemId") REFERENCES "LaundryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LaundryBatch_number_key" ON "LaundryBatch"("number");
