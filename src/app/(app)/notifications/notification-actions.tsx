"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MarkNotificationReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markRead() {
    setLoading(true);
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button type="button" size="sm" variant="ghost" onClick={markRead} disabled={loading}>
      Mark read
    </Button>
  );
}

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markAllRead() {
    setLoading(true);
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={markAllRead} disabled={disabled || loading}>
      Mark all read
    </Button>
  );
}
