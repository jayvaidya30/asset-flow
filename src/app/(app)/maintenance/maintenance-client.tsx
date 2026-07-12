"use client";

import { FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Request = {
  id: string;
  assetId: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  photoUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "TECHNICIAN_ASSIGNED" | "IN_PROGRESS" | "RESOLVED";
  createdAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  asset: { id: string; assetTag: string; name: string };
  raisedBy: { id: string; name: string };
  technician: { id: string; name: string } | null;
};

type Props = {
  role: string;
  assets: { id: string; assetTag: string; name: string; status: string }[];
  technicians: { id: string; name: string }[];
  requests: Request[];
};

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function statusVariant(status: Request["status"]) {
  if (status === "RESOLVED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "PENDING") return "warning" as const;
  return "secondary" as const;
}

async function request(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
  return body.data;
}

export function MaintenanceClient({ role, assets, technicians, requests }: Props) {
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id ?? "");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await request("/api/maintenance", { method: "POST", body: JSON.stringify({ assetId, priority, description, photoUrl }) });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to raise maintenance request.");
    } finally {
      setPending(false);
    }
  }

  async function action(id: string, body: Record<string, string>) {
    setPending(true);
    setMessage(null);
    try {
      await request(`/api/maintenance/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Maintenance</h1><p className="mt-1 text-sm text-muted-foreground">Report issues and follow each repair through resolution.</p></div><Badge variant="outline">{requests.length} visible requests</Badge></div>
      <Card>
        <CardHeader><CardTitle>Raise a maintenance request</CardTitle></CardHeader>
        <CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="grid gap-1.5 text-sm font-medium"><span>Asset</span><NativeSelect value={assetId} onChange={(event) => setAssetId(event.target.value)} required>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} · {asset.name}</option>)}</NativeSelect></label><label className="grid gap-1.5 text-sm font-medium"><span>Priority</span><NativeSelect value={priority} onChange={(event) => setPriority(event.target.value)}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></NativeSelect></label><label className="grid gap-1.5 text-sm font-medium"><span>Photo URL</span><Input type="url" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="https://..." /></label><div className="flex items-end"><Button className="w-full" disabled={pending || !assetId}>Submit request</Button></div><label className="grid gap-1.5 text-sm font-medium md:col-span-2 xl:col-span-4"><span>Issue description</span><textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={2000} required placeholder="Describe the problem, its impact, and anything already tried." /></label></form>{message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Request workflow</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Raised by</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Technician</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{requests.map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.asset.name}</p><p className="max-w-64 truncate text-xs text-muted-foreground">{item.description}</p><p className="text-xs text-muted-foreground">{item.asset.assetTag} · {dateTime.format(new Date(item.createdAt))}</p></TableCell><TableCell>{item.raisedBy.name}</TableCell><TableCell><Badge variant={item.priority === "HIGH" ? "danger" : item.priority === "MEDIUM" ? "warning" : "secondary"}>{item.priority}</Badge></TableCell><TableCell><Badge variant={statusVariant(item.status)}>{item.status.replaceAll("_", " ")}</Badge>{item.resolutionNotes && <p className="mt-1 max-w-48 text-xs text-muted-foreground">{item.resolutionNotes}</p>}</TableCell><TableCell>{item.technician?.name ?? "Unassigned"}</TableCell><TableCell className="min-w-48 text-right">{role === "ASSET_MANAGER" && <div className="flex flex-wrap justify-end gap-2">{item.status === "PENDING" && <><Button size="sm" disabled={pending} onClick={() => action(item.id, { action: "approve" })}>Approve</Button><Button size="sm" variant="destructive" disabled={pending} onClick={() => action(item.id, { action: "reject" })}>Reject</Button></>}{item.status === "APPROVED" && <><NativeSelect className="h-9 w-36" value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}</NativeSelect><Button size="sm" disabled={pending || !technicianId} onClick={() => action(item.id, { action: "assign", technicianId })}>Assign</Button></>}{item.status === "TECHNICIAN_ASSIGNED" && <Button size="sm" disabled={pending} onClick={() => action(item.id, { action: "start" })}>Start work</Button>}{item.status === "IN_PROGRESS" && <div className="flex gap-2"><Input className="h-9 w-40" value={resolutionNotes[item.id] ?? ""} onChange={(event) => setResolutionNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Resolution notes" /><Button size="sm" disabled={pending || !(resolutionNotes[item.id] ?? "").trim()} onClick={() => action(item.id, { action: "resolve", resolutionNotes: resolutionNotes[item.id] })}>Resolve</Button></div>}</div>}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </div>
  );
}
