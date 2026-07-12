import { PrismaClient, Role, AssetStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Everyone logs in with password: Password123!
const PASSWORD = "Password123!";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Departments ────────────────────────────────────────────
  const it = await prisma.department.create({ data: { name: "IT" } });
  const ops = await prisma.department.create({ data: { name: "Operations" } });
  const facilities = await prisma.department.create({
    data: { name: "Facilities", parentId: ops.id },
  });

  // ── Employees / roles ──────────────────────────────────────
  const admin = await prisma.employee.create({
    data: { name: "Ava Admin", email: "admin@assetflow.dev", passwordHash, role: Role.ADMIN, departmentId: it.id },
  });
  const manager = await prisma.employee.create({
    data: { name: "Max Manager", email: "manager@assetflow.dev", passwordHash, role: Role.ASSET_MANAGER, departmentId: it.id },
  });
  const head = await prisma.employee.create({
    data: { name: "Hana Head", email: "head@assetflow.dev", passwordHash, role: Role.DEPARTMENT_HEAD, departmentId: ops.id },
  });
  const priya = await prisma.employee.create({
    data: { name: "Priya Patel", email: "priya@assetflow.dev", passwordHash, role: Role.EMPLOYEE, departmentId: it.id },
  });
  const raj = await prisma.employee.create({
    data: { name: "Raj Kumar", email: "raj@assetflow.dev", passwordHash, role: Role.EMPLOYEE, departmentId: ops.id },
  });

  await prisma.department.update({ where: { id: it.id }, data: { headId: manager.id } });
  await prisma.department.update({ where: { id: ops.id }, data: { headId: head.id } });

  // ── Categories ─────────────────────────────────────────────
  const electronics = await prisma.assetCategory.create({
    data: {
      name: "Electronics",
      customFields: [{ key: "warrantyMonths", label: "Warranty (months)", type: "number" }],
    },
  });
  const furniture = await prisma.assetCategory.create({ data: { name: "Furniture" } });
  const vehicles = await prisma.assetCategory.create({ data: { name: "Vehicles" } });
  const rooms = await prisma.assetCategory.create({ data: { name: "Rooms" } });

  // ── Assets ─────────────────────────────────────────────────
  let tagCounter = 0;
  const nextTag = () => `AF-${String(++tagCounter).padStart(4, "0")}`;

  const laptop = await prisma.asset.create({
    data: {
      assetTag: nextTag(),
      name: "Dell Latitude Laptop",
      serialNumber: "SN-LAP-114",
      categoryId: electronics.id,
      condition: "Good",
      location: "IT Store Room",
      status: AssetStatus.ALLOCATED,
      customValues: { warrantyMonths: 24 },
    },
  });
  await prisma.asset.create({
    data: { assetTag: nextTag(), name: "Office Desk", categoryId: furniture.id, condition: "Good", location: "Floor 2", status: AssetStatus.AVAILABLE },
  });
  await prisma.asset.create({
    data: { assetTag: nextTag(), name: "Company Van", categoryId: vehicles.id, condition: "Fair", location: "Parking A", isBookable: true, status: AssetStatus.AVAILABLE },
  });
  const roomB2 = await prisma.asset.create({
    data: { assetTag: nextTag(), name: "Meeting Room B2", categoryId: rooms.id, location: "Floor 1", isBookable: true, status: AssetStatus.AVAILABLE },
  });

  // ── Allocation: Priya holds the laptop (spec example) ──────
  await prisma.allocation.create({
    data: {
      assetId: laptop.id,
      holderId: priya.id,
      allocatedById: manager.id,
      expectedReturnDate: new Date(Date.now() - 2 * 24 * 3600 * 1000), // overdue for demo
    },
  });

  // ── A sample booking on Room B2 (9:00–10:00 today) ─────────
  const today = new Date();
  const at = (h: number, m = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m);
  await prisma.booking.create({
    data: { assetId: roomB2.id, bookedById: raj.id, startTime: at(9), endTime: at(10), purpose: "Standup" },
  });

  console.log("Seed complete.");
  console.log("Login with any of these (password: %s):", PASSWORD);
  console.log("  admin@assetflow.dev     (ADMIN)");
  console.log("  manager@assetflow.dev   (ASSET_MANAGER)");
  console.log("  head@assetflow.dev      (DEPARTMENT_HEAD)");
  console.log("  priya@assetflow.dev     (EMPLOYEE, holds laptop AF-0001)");
  console.log("  raj@assetflow.dev       (EMPLOYEE)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
