import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getManagedDepartmentIds, listBookings } from "@/lib/track3";
import { BookingsClient } from "./bookings-client";

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [bookings, assets] = await Promise.all([
    listBookings(),
    prisma.asset.findMany({
      where: { isBookable: true },
      select: { id: true, assetTag: true, name: true, location: true, status: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const departmentIds = session.role === "DEPARTMENT_HEAD" ? await getManagedDepartmentIds(session) : [];
  const departments = departmentIds.length
    ? await prisma.department.findMany({ where: { id: { in: departmentIds }, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  return (
    <BookingsClient
      currentUserId={session.sub}
      role={session.role}
      assets={assets}
      departments={departments}
      bookings={bookings.map((booking) => ({
        ...booking,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
      }))}
    />
  );
}
