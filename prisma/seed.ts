import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Permission presets per role. Admin gets everything via the `admin` flag.
const ROLES: {
  key: string;
  name: string;
  isStaffRole: boolean;
  permissions: Record<string, boolean>;
}[] = [
  { key: "admin", name: "Admin / Owner", isStaffRole: false, permissions: { admin: true } },
  {
    key: "supervisor",
    name: "Supervisor",
    isStaffRole: false,
    permissions: {
      dashboard: true,
      workorders: true,
      properties: true,
      clients: true,
      mytasks: true,
      reports: true,
    },
  },
  { key: "cleaner", name: "Cleaner", isStaffRole: true, permissions: { mytasks: true } },
  { key: "driver", name: "Driver", isStaffRole: true, permissions: { mytasks: true } },
  { key: "technician", name: "Technician", isStaffRole: true, permissions: { mytasks: true } },
  { key: "laundry", name: "Laundry Staff", isStaffRole: true, permissions: { mytasks: true } },
  { key: "client", name: "Client Portal", isStaffRole: false, permissions: {} },
];

const STATUSES: { scope: string; key: string; label: string; sortOrder: number; isDefault?: boolean; isTerminal?: boolean }[] = [
  // Work order
  { scope: "workorder", key: "draft", label: "Draft", sortOrder: 0, isDefault: true },
  { scope: "workorder", key: "scheduled", label: "Scheduled", sortOrder: 1 },
  { scope: "workorder", key: "in_progress", label: "In progress", sortOrder: 2 },
  { scope: "workorder", key: "partially_completed", label: "Partially completed", sortOrder: 3 },
  { scope: "workorder", key: "completed", label: "Completed", sortOrder: 4 },
  { scope: "workorder", key: "cancelled", label: "Cancelled", sortOrder: 5, isTerminal: true },
  { scope: "workorder", key: "invoiced", label: "Invoiced", sortOrder: 6 },
  { scope: "workorder", key: "paid", label: "Paid", sortOrder: 7, isTerminal: true },
  // Service line
  { scope: "serviceline", key: "pending", label: "Pending", sortOrder: 0, isDefault: true },
  { scope: "serviceline", key: "assigned", label: "Assigned", sortOrder: 1 },
  { scope: "serviceline", key: "in_progress", label: "In progress", sortOrder: 2 },
  { scope: "serviceline", key: "completed", label: "Completed", sortOrder: 3 },
  { scope: "serviceline", key: "on_hold", label: "On hold", sortOrder: 4 },
  { scope: "serviceline", key: "cancelled", label: "Cancelled", sortOrder: 5, isTerminal: true },
  // Task
  { scope: "task", key: "pending", label: "Pending", sortOrder: 0, isDefault: true },
  { scope: "task", key: "assigned", label: "Assigned", sortOrder: 1 },
  { scope: "task", key: "in_progress", label: "In progress", sortOrder: 2 },
  { scope: "task", key: "completed", label: "Completed", sortOrder: 3 },
  { scope: "task", key: "rejected", label: "Rejected", sortOrder: 4 },
  { scope: "task", key: "overdue", label: "Overdue", sortOrder: 5 },
  { scope: "task", key: "cancelled", label: "Cancelled", sortOrder: 6, isTerminal: true },
];

async function main() {
  console.log("Seeding Brilla Operations System...");

  // --- Roles ---
  for (const r of ROLES) {
    await db.role.upsert({
      where: { key: r.key },
      create: {
        key: r.key,
        name: r.name,
        isStaffRole: r.isStaffRole,
        permissions: JSON.stringify(r.permissions),
      },
      update: { name: r.name, permissions: JSON.stringify(r.permissions) },
    });
  }

  // --- Statuses ---
  for (const s of STATUSES) {
    await db.statusOption.upsert({
      where: { scope_key: { scope: s.scope, key: s.key } },
      create: {
        scope: s.scope,
        key: s.key,
        label: s.label,
        sortOrder: s.sortOrder,
        isDefault: s.isDefault ?? false,
        isTerminal: s.isTerminal ?? false,
      },
      update: { label: s.label, sortOrder: s.sortOrder },
    });
  }

  // --- Settings (global company + finance/VAT) ---
  await db.setting.upsert({
    where: { key: "company" },
    create: {
      key: "company",
      value: JSON.stringify({
        name: "Brilla Services",
        address: "",
        phone: "",
        email: "",
        logoUrl: "",
      }),
    },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "finance" },
    create: {
      key: "finance",
      value: JSON.stringify({
        currency: "AED",
        vatEnabled: true,
        vatRate: 5,
        vatNumber: "",
        inclusive: false,
        paymentTerms: "Due on receipt",
      }),
    },
    update: {},
  });

  // --- Service categories (examples only — fully configurable) ---
  const categories = ["Cleaning", "Laundry", "Pest Control", "Pool Cleaning", "Gardening", "Maintenance"];
  for (const name of categories) {
    await db.serviceCategory.upsert({ where: { name }, create: { name }, update: {} });
  }
  const cleaningCat = await db.serviceCategory.findUnique({ where: { name: "Cleaning" } });

  // --- Client types ---
  const clientTypes = ["Residential", "Airbnb Owner", "Property Manager", "Company", "Hotel", "Landlord"];
  for (const name of clientTypes) {
    await db.clientType.upsert({ where: { name }, create: { name }, update: {} });
  }
  const residential = await db.clientType.findUnique({ where: { name: "Residential" } });

  // --- Skills ---
  const skills = [
    { key: "driving_licence", name: "Driving Licence", isCertificate: true },
    { key: "pest_licence", name: "Pest Control Licence", isCertificate: true },
    { key: "key_holder", name: "Key Holder Approved", isCertificate: false },
    { key: "supervisor_approved", name: "Supervisor Approved", isCertificate: false },
  ];
  for (const s of skills) {
    await db.skillOption.upsert({ where: { key: s.key }, create: s, update: {} });
  }

  // --- Property field definitions (admin-defined dynamic attributes) ---
  const propFields = [
    { key: "bedrooms", label: "Bedrooms", type: "number", sortOrder: 0 },
    { key: "bathrooms", label: "Bathrooms", type: "number", sortOrder: 1 },
    { key: "pools", label: "Pools", type: "number", sortOrder: 2 },
    { key: "sqm", label: "Square metres", type: "number", sortOrder: 3 },
  ];
  for (const f of propFields) {
    const existing = await db.fieldDefinition.findFirst({
      where: { scope: "property", ownerId: null, key: f.key },
    });
    if (!existing) {
      await db.fieldDefinition.create({
        data: { scope: "property", ownerId: null, key: f.key, label: f.label, type: f.type, sortOrder: f.sortOrder },
      });
    }
  }

  // --- Demo users ---
  const adminPass = await bcrypt.hash("admin123", 10);
  const admin = await db.user.upsert({
    where: { email: "admin@brilla.local" },
    create: { email: "admin@brilla.local", name: "Brilla Admin", passwordHash: adminPass },
    update: {},
  });
  const adminRole = await db.role.findUnique({ where: { key: "admin" } });
  if (adminRole) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      create: { userId: admin.id, roleId: adminRole.id },
      update: {},
    });
  }

  const cleanerPass = await bcrypt.hash("cleaner123", 10);
  const cleaner = await db.user.upsert({
    where: { email: "cleaner@brilla.local" },
    create: { email: "cleaner@brilla.local", name: "Sam Cleaner", passwordHash: cleanerPass },
    update: {},
  });
  const cleanerRole = await db.role.findUnique({ where: { key: "cleaner" } });
  if (cleanerRole) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: cleaner.id, roleId: cleanerRole.id } },
      create: { userId: cleaner.id, roleId: cleanerRole.id },
      update: {},
    });
  }
  const cleanerProfile = await db.staffProfile.upsert({
    where: { userId: cleaner.id },
    create: { userId: cleaner.id, employeeType: "full-time", skills: JSON.stringify(["key_holder"]) },
    update: {},
  });
  await db.payrollRule.upsert({
    where: { staffId: cleanerProfile.id },
    create: { staffId: cleanerProfile.id, payType: "hybrid", baseHourlyRate: 20, commissionPercent: 10 },
    update: {},
  });

  // --- Sample checklist ---
  const checklist = await db.checklistTemplate.create({
    data: {
      name: "Standard Cleaning Checklist",
      items: {
        create: [
          { label: "Kitchen cleaned", required: true, photoRequired: true, sortOrder: 0 },
          { label: "Bathrooms cleaned", required: true, photoRequired: true, sortOrder: 1 },
          { label: "Floors mopped", required: true, sortOrder: 2 },
          { label: "Bins emptied", required: false, sortOrder: 3 },
        ],
      },
    },
  });

  // --- Sample configurable service: "Standard Cleaning" priced hourly × rate × manpower ---
  const service = await db.service.create({
    data: {
      name: "Standard Cleaning",
      code: "CLN-STD",
      categoryId: cleaningCat?.id,
      description: "General property cleaning, priced by hours and crew size.",
      active: true,
      isPublic: true,
      colour: "#0f766e",
    },
  });
  const version = await db.serviceVersion.create({
    data: {
      serviceId: service.id,
      version: 1,
      isActive: true,
      defaultDuration: 120,
      pricingType: "hourlyManpower",
      pricingConfig: JSON.stringify({ rate: 25, manpower: 2 }),
      pricingRules: JSON.stringify({ minCharge: 80, weekendFee: 20 }),
      formFields: JSON.stringify([
        { key: "hours", label: "Estimated hours", type: "number", required: true },
        { key: "manpower", label: "Cleaners", type: "number", required: true },
        { key: "special_instructions", label: "Special instructions", type: "notes" },
      ]),
      checklistTemplateId: checklist.id,
      payrollRuleConfig: JSON.stringify({ payType: "hybrid", commissionPercent: 10 }),
      allowedRoleKeys: JSON.stringify(["cleaner"]),
      taskTemplateRows: {
        create: [
          {
            name: "Clean property",
            taskType: "cleaning",
            requiredRoleKey: "cleaner",
            checklistTemplateId: checklist.id,
            photosRequired: true,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // Make the cleaner eligible for the cleaning service
  await db.serviceEligibility.upsert({
    where: { staffId_serviceId: { staffId: cleanerProfile.id, serviceId: service.id } },
    create: { staffId: cleanerProfile.id, serviceId: service.id },
    update: {},
  });

  // --- Sample client + property ---
  const client = await db.client.create({
    data: {
      name: "Acme Holdings",
      email: "ops@acme.local",
      phone: "+971500000000",
      clientTypeId: residential?.id,
      paymentTerms: "Due on receipt",
    },
  });
  await db.property.create({
    data: {
      clientId: client.id,
      name: "Marina Apartment 1203",
      address: "Dubai Marina, Tower A, 1203",
      propertyType: "Apartment",
      accessInstructions: "Keybox by the door, code in keyboxCode.",
      keyboxCode: "4821",
      fieldValues: JSON.stringify({ bedrooms: 2, bathrooms: 2, sqm: 95 }),
    },
  });

  console.log("Seed complete.");
  console.log("  Admin login:   admin@brilla.local / admin123");
  console.log("  Cleaner login: cleaner@brilla.local / cleaner123");
  console.log(`  Sample service version id: ${version.id}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
