import { prisma } from "./db";

/**
 * Single entry point for creating notifications. Every track calls this instead
 * of writing to the Notification table directly, so Track 4 (Dashboard/Notifications)
 * owns the read side and the other tracks just emit events.
 *
 * Example:
 *   await notify(priya.id, "ASSET_ASSIGNED", "Laptop AF-0001 assigned to you", { linkUrl: "/assets/..." });
 */

export type NotificationType =
  | "ASSET_ASSIGNED"
  | "TRANSFER_REQUESTED"
  | "TRANSFER_APPROVED"
  | "MAINTENANCE_APPROVED"
  | "MAINTENANCE_REJECTED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_REMINDER"
  | "OVERDUE_RETURN"
  | "AUDIT_DISCREPANCY";

export async function notify(
  userId: string,
  type: NotificationType,
  message: string,
  opts?: { title?: string; linkUrl?: string }
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title: opts?.title ?? defaultTitle(type),
      message,
      linkUrl: opts?.linkUrl,
    },
  });
}

/** Notify several users at once (e.g. all auditors on a cycle). */
export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  message: string,
  opts?: { title?: string; linkUrl?: string }
) {
  if (!userIds.length) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title: opts?.title ?? defaultTitle(type),
      message,
      linkUrl: opts?.linkUrl,
    })),
  });
}

function defaultTitle(type: NotificationType): string {
  const map: Record<NotificationType, string> = {
    ASSET_ASSIGNED: "Asset assigned",
    TRANSFER_REQUESTED: "Transfer requested",
    TRANSFER_APPROVED: "Transfer approved",
    MAINTENANCE_APPROVED: "Maintenance approved",
    MAINTENANCE_REJECTED: "Maintenance rejected",
    BOOKING_CONFIRMED: "Booking confirmed",
    BOOKING_CANCELLED: "Booking cancelled",
    BOOKING_REMINDER: "Booking reminder",
    OVERDUE_RETURN: "Overdue return",
    AUDIT_DISCREPANCY: "Audit discrepancy flagged",
  };
  return map[type];
}
