import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getAuditCycleForViewer, listAuditCycles } from "@/lib/track3";
import { AuditsClient } from "./audits-client";

export default async function AuditsPage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [{ cycle: requestedCycleId }, cycles] = await Promise.all([searchParams, listAuditCycles(session)]);
  const selectedCycleId = requestedCycleId && cycles.some((cycle) => cycle.id === requestedCycleId) ? requestedCycleId : cycles[0]?.id;
  const [selectedCycle, departments, employees] = await Promise.all([
    selectedCycleId ? getAuditCycleForViewer(session, selectedCycleId) : Promise.resolve(null),
    session.role === "ADMIN" ? prisma.department.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    session.role === "ADMIN" ? prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return <AuditsClient role={session.role} userId={session.sub} cycles={cycles.map((cycle) => ({ ...cycle, startDate: cycle.startDate.toISOString(), endDate: cycle.endDate.toISOString(), closedAt: cycle.closedAt?.toISOString() ?? null, createdAt: cycle.createdAt.toISOString(), updatedAt: cycle.updatedAt.toISOString() }))} selectedCycle={selectedCycle ? { ...selectedCycle, startDate: selectedCycle.startDate.toISOString(), endDate: selectedCycle.endDate.toISOString(), closedAt: selectedCycle.closedAt?.toISOString() ?? null, createdAt: selectedCycle.createdAt.toISOString(), updatedAt: selectedCycle.updatedAt.toISOString(), items: selectedCycle.items.map((item) => ({ ...item, checkedAt: item.checkedAt?.toISOString() ?? null })) } : null} departments={departments} employees={employees} />;
}
