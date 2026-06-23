-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "base" REAL NOT NULL DEFAULT 0,
    "commission" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "computedFrom" TEXT NOT NULL DEFAULT '{}',
    "isAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "stockLevel" REAL NOT NULL DEFAULT 0,
    "lowStockThreshold" REAL NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "assignedTo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "serviceLineId" TEXT,
    "staffId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryUsage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryUsage_serviceLineId_fkey" FOREIGN KEY ("serviceLineId") REFERENCES "ServiceLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryUsage_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringWorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT '[]',
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "daysOfWeek" TEXT NOT NULL DEFAULT '[]',
    "nextRunAt" DATETIME NOT NULL,
    "lastRunAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "serviceLineId" TEXT,
    "name" TEXT NOT NULL,
    "taskType" TEXT,
    "requiredRoleKey" TEXT,
    "assignedStaffId" TEXT,
    "dueAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "checklistTemplateId" TEXT,
    "photosRequired" BOOLEAN NOT NULL DEFAULT false,
    "notesRequired" BOOLEAN NOT NULL DEFAULT false,
    "signatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "dependsOnTaskId" TEXT,
    "checklistResults" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "signatureData" TEXT,
    "qualityStatus" TEXT,
    "reviewNotes" TEXT,
    "reviewedById" TEXT,
    "isRevisit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_serviceLineId_fkey" FOREIGN KEY ("serviceLineId") REFERENCES "ServiceLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "StaffProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assignedStaffId", "checklistResults", "checklistTemplateId", "completedAt", "createdAt", "dependsOnTaskId", "dueAt", "id", "name", "notes", "notesRequired", "photosRequired", "requiredRoleKey", "serviceLineId", "signatureData", "signatureRequired", "startedAt", "status", "taskType", "updatedAt", "workOrderId") SELECT "assignedStaffId", "checklistResults", "checklistTemplateId", "completedAt", "createdAt", "dependsOnTaskId", "dueAt", "id", "name", "notes", "notesRequired", "photosRequired", "requiredRoleKey", "serviceLineId", "signatureData", "signatureRequired", "startedAt", "status", "taskType", "updatedAt", "workOrderId" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_name_key" ON "InventoryCategory"("name");
