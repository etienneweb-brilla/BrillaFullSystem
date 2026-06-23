-- AlterTable
ALTER TABLE "LaundryBatch" ADD COLUMN "cleanerStaffId" TEXT;

-- AlterTable
ALTER TABLE "RecurringWorkOrder" ADD COLUMN "endDate" DATETIME;
ALTER TABLE "RecurringWorkOrder" ADD COLUMN "startDate" DATETIME;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "priority" TEXT;
ALTER TABLE "Task" ADD COLUMN "scheduledEnd" DATETIME;
ALTER TABLE "Task" ADD COLUMN "scheduledStart" DATETIME;

-- CreateTable
CREATE TABLE "PricingVariable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'input',
    "attributeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT,
    "colour" TEXT,
    "internalNotes" TEXT,
    "clientNotes" TEXT,
    "recommendedFrequencies" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Service" ("active", "categoryId", "clientNotes", "code", "colour", "createdAt", "description", "icon", "id", "internalNotes", "isPublic", "name", "updatedAt") SELECT "active", "categoryId", "clientNotes", "code", "colour", "createdAt", "description", "icon", "id", "internalNotes", "isPublic", "name", "updatedAt" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE TABLE "new_ServiceVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultDuration" INTEGER,
    "pricingType" TEXT NOT NULL DEFAULT 'fixed',
    "pricingConfig" TEXT NOT NULL DEFAULT '{}',
    "pricingRules" TEXT NOT NULL DEFAULT '{}',
    "pricingVariables" TEXT NOT NULL DEFAULT '[]',
    "defaultPrice" REAL,
    "formFields" TEXT NOT NULL DEFAULT '[]',
    "taskTemplates" TEXT NOT NULL DEFAULT '[]',
    "checklistTemplateId" TEXT,
    "payrollRuleConfig" TEXT NOT NULL DEFAULT '{}',
    "automationRules" TEXT NOT NULL DEFAULT '[]',
    "allowedRoleKeys" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceVersion_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ServiceVersion" ("allowedRoleKeys", "automationRules", "checklistTemplateId", "createdAt", "defaultDuration", "defaultPrice", "formFields", "id", "isActive", "payrollRuleConfig", "pricingConfig", "pricingRules", "pricingType", "serviceId", "taskTemplates", "version") SELECT "allowedRoleKeys", "automationRules", "checklistTemplateId", "createdAt", "defaultDuration", "defaultPrice", "formFields", "id", "isActive", "payrollRuleConfig", "pricingConfig", "pricingRules", "pricingType", "serviceId", "taskTemplates", "version" FROM "ServiceVersion";
DROP TABLE "ServiceVersion";
ALTER TABLE "new_ServiceVersion" RENAME TO "ServiceVersion";
CREATE UNIQUE INDEX "ServiceVersion_serviceId_version_key" ON "ServiceVersion"("serviceId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PricingVariable_key_key" ON "PricingVariable"("key");
