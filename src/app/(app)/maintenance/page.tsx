import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listMaintenanceRequests } from "@/lib/track3";
import { MaintenanceClient } from "./maintenance-client";

export default async function MaintenancePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [requests, assets, technicians] = await Promise.all([
    listMaintenanceRequests(session),
    prisma.asset.findMany({
      where: { status: { notIn: ["DISPOSED", "RETIRED", "LOST"] } },
      select: { id: true, assetTag: true, name: true, status: true },
      orderBy: { assetTag: "asc" },
    }),
    session.role === "ASSET_MANAGER"
      ? prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  return <MaintenanceClient role={session.role} assets={assets} technicians={technicians} requests={requests.map((request) => ({ ...request, createdAt: request.createdAt.toISOString(), resolvedAt: request.resolvedAt?.toISOString() ?? null }))} />;
}
