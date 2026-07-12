"use client";

import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Booking = {
  id: string;
  assetId: string;
  bookedById: string;
  departmentId: string | null;
  startTime: string;
  endTime: string;
  purpose: string | null;
  status: "UPCOMING" | "ONGOING" | "COMPLETED" | "CANCELLED";
  asset: { id: string; assetTag: string; name: string; location: string | null };
  bookedBy: { id: string; name: string };
  department: { id: string; name: string } | null;
};

type Props = {
  currentUserId: string;
  role: string;
  assets: { id: string; assetTag: string; name: string; location: string | null; status: string }[];
  departments: { id: string; name: string }[];
  bookings: Booking[];
};

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function localInputValue(value: string | Date) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function statusVariant(status: Booking["status"]) {
  if (status === "ONGOING") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "COMPLETED") return "secondary" as const;
  return "warning" as const;
}

async function request(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
  return body.data;
}

export function BookingsClient({ currentUserId, role, assets, departments, bookings }: Props) {
  const [weekStart, setWeekStart] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date;
  });
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [startTime, setStartTime] = useState(() => localInputValue(new Date(Date.now() + 3_600_000)));
  const [endTime, setEndTime] = useState(() => localInputValue(new Date(Date.now() + 7_200_000)));
  const [purpose, setPurpose] = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  }), [weekStart]);
  const inWeek = bookings.filter((booking) => {
    const start = new Date(booking.startTime);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return start >= weekStart && start < end;
  });

  function resetForm() {
    setEditingId(null);
    setPurpose("");
    setStartTime(localInputValue(new Date(Date.now() + 3_600_000)));
    setEndTime(localInputValue(new Date(Date.now() + 7_200_000)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      if (editingId) {
        await request(`/api/bookings/${editingId}`, { method: "PATCH", body: JSON.stringify({ action: "reschedule", startTime, endTime, purpose }) });
        setMessage("Booking rescheduled.");
      } else {
        await request("/api/bookings", { method: "POST", body: JSON.stringify({ assetId, startTime, endTime, purpose, ...(departmentId ? { departmentId } : {}) }) });
        setMessage("Booking confirmed.");
      }
      resetForm();
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save booking.");
    } finally {
      setPending(false);
    }
  }

  async function cancelBooking(id: string) {
    setPending(true);
    setMessage(null);
    try {
      await request(`/api/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to cancel booking.");
    } finally {
      setPending(false);
    }
  }

  function beginReschedule(booking: Booking) {
    setEditingId(booking.id);
    setAssetId(booking.assetId);
    setStartTime(localInputValue(booking.startTime));
    setEndTime(localInputValue(booking.endTime));
    setPurpose(booking.purpose ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Resource Bookings</h1><p className="mt-1 text-sm text-muted-foreground">Reserve shared resources without schedule conflicts.</p></div>
        <Badge variant="outline">{assets.length} bookable resources</Badge>
      </div>
      <Card>
        <CardHeader><CardTitle>{editingId ? "Reschedule booking" : "Reserve a resource"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-1.5 text-sm font-medium"><span>Resource</span><NativeSelect value={assetId} onChange={(event) => setAssetId(event.target.value)} disabled={Boolean(editingId)} required>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} · {asset.name}</option>)}</NativeSelect></label>
            {role === "DEPARTMENT_HEAD" && <label className="grid gap-1.5 text-sm font-medium"><span>For department</span><NativeSelect value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</NativeSelect></label>}
            <label className="grid gap-1.5 text-sm font-medium"><span>Start</span><Input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>End</span><Input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>Purpose</span><Input value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={500} placeholder="Team meeting" /></label>
            <div className="flex items-end gap-2"><Button className="w-full" disabled={pending || !assetId}>{pending ? "Saving..." : editingId ? "Save changes" : "Book resource"}</Button>{editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}</div>
          </form>
          {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Weekly calendar</CardTitle><div className="flex gap-2"><Button size="sm" variant="outline" aria-label="Previous week" onClick={() => setWeekStart((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7))}>&lt;</Button><Button size="sm" variant="outline" onClick={() => setWeekStart(new Date(new Date().setDate(new Date().getDate() - new Date().getDay())))}>Today</Button><Button size="sm" variant="outline" aria-label="Next week" onClick={() => setWeekStart((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7))}>&gt;</Button></div></CardHeader>
        <CardContent><div className="grid min-w-[760px] grid-cols-7 border-l border-t">{weekDays.map((day) => <div key={day.toISOString()} className="min-h-52 border-b border-r p-2"><p className="mb-2 text-xs font-medium text-muted-foreground">{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(day)}</p>{inWeek.filter((booking) => new Date(booking.startTime).toDateString() === day.toDateString()).map((booking) => <div key={booking.id} className="mb-2 border-l-2 border-primary bg-secondary p-2 text-xs"><p className="font-medium">{booking.asset.name}</p><p>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(booking.startTime))}</p><p className="truncate text-muted-foreground">{booking.bookedBy.name}</p></div>)}</div>)}</div></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Booking history</CardTitle></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>Resource</TableHead><TableHead>Time</TableHead><TableHead>Booked by</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{bookings.map((booking) => { const editable = booking.bookedById === currentUserId || (role === "DEPARTMENT_HEAD" && booking.departmentId); return <TableRow key={booking.id}><TableCell><p className="font-medium">{booking.asset.name}</p><p className="text-xs text-muted-foreground">{booking.asset.assetTag}{booking.asset.location ? ` · ${booking.asset.location}` : ""}</p></TableCell><TableCell>{dateTime.format(new Date(booking.startTime))}<p className="text-xs text-muted-foreground">to {dateTime.format(new Date(booking.endTime))}</p></TableCell><TableCell>{booking.bookedBy.name}</TableCell><TableCell><Badge variant={statusVariant(booking.status)}>{booking.status.replaceAll("_", " ")}</Badge></TableCell><TableCell className="text-right">{editable && booking.status === "UPCOMING" && <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => beginReschedule(booking)}>Reschedule</Button><Button size="sm" variant="destructive" disabled={pending} onClick={() => cancelBooking(booking.id)}>Cancel</Button></div>}</TableCell></TableRow>; })}</TableBody></Table></CardContent>
      </Card>
    </div>
  );
}
