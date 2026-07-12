"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Cycle = {
  id: string;
  name: string;
  status: "OPEN" | "CLOSED";
  scopeLocation: string | null;
  scopeDepartment: { id: string; name: string } | null;
  startDate: string;
  endDate: string;
  closedAt: string | null;
  _count: { items: number; assignments: number };
};
type SelectedCycle = Cycle & {
  createdAt: string;
  updatedAt: string;
  assignments: { id: string; auditorId: string; auditor: { id: string; name: string; email: string } }[];
  items: { id: string; assetId: string; result: "PENDING" | "VERIFIED" | "MISSING" | "DAMAGED"; notes: string | null; auditorId: string | null; checkedAt: string | null; asset: { id: string; assetTag: string; name: string; location: string | null; status: string }; auditor: { id: string; name: string } | null }[];
};
type Props = { role: string; userId: string; cycles: Cycle[]; selectedCycle: SelectedCycle | null; departments: { id: string; name: string }[]; employees: { id: string; name: string; email: string }[] };

function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }
function resultVariant(result: string) { if (result === "VERIFIED") return "success" as const; if (result === "MISSING") return "danger" as const; if (result === "DAMAGED") return "warning" as const; return "secondary" as const; }
async function request(url: string, options: RequestInit) { const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Something went wrong."); return body.data; }

export function AuditsClient({ role, userId, cycles, selectedCycle, departments, employees }: Props) {
  const [name, setName] = useState("");
  const [scopeDepartmentId, setScopeDepartmentId] = useState("");
  const [scopeLocation, setScopeLocation] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = role === "ADMIN";
  const isAssigned = Boolean(selectedCycle?.assignments.some((assignment) => assignment.auditorId === userId));
  const discrepancies = useMemo(() => selectedCycle?.items.filter((item) => item.result === "MISSING" || item.result === "DAMAGED") ?? [], [selectedCycle]);

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(null);
    try { await request("/api/audits", { method: "POST", body: JSON.stringify({ name, scopeDepartmentId: scopeDepartmentId || undefined, scopeLocation: scopeLocation || undefined, startDate, endDate }) }); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create cycle."); }
    finally { setPending(false); }
  }
  async function assign() {
    if (!selectedCycle || !selectedAuditors.length) return;
    setPending(true); setMessage(null);
    try { await request(`/api/audits/${selectedCycle.id}/auditors`, { method: "POST", body: JSON.stringify({ auditorIds: selectedAuditors }) }); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to assign auditors."); }
    finally { setPending(false); }
  }
  async function markItem(assetId: string, result: string) {
    if (!selectedCycle || result === "PENDING") return;
    setPending(true); setMessage(null);
    try { await request(`/api/audits/${selectedCycle.id}/items/${assetId}`, { method: "PATCH", body: JSON.stringify({ result, notes: notes[assetId] ?? "" }) }); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to record audit result."); }
    finally { setPending(false); }
  }
  async function closeCycle() {
    if (!selectedCycle) return;
    setPending(true); setMessage(null);
    try { await request(`/api/audits/${selectedCycle.id}/close`, { method: "POST", body: "{}" }); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to close cycle."); }
    finally { setPending(false); }
  }

  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Asset Audits</h1><p className="mt-1 text-sm text-muted-foreground">Verify physical assets, record discrepancies, and retain a complete audit trail.</p></div><Badge variant="outline">{cycles.filter((cycle) => cycle.status === "OPEN").length} open cycles</Badge></div>
    {isAdmin && <Card><CardHeader><CardTitle>Create audit cycle</CardTitle></CardHeader><CardContent><form onSubmit={createCycle} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><label className="grid gap-1.5 text-sm font-medium"><span>Cycle name</span><Input value={name} onChange={(event) => setName(event.target.value)} minLength={3} required placeholder="Q3 facilities audit" /></label><label className="grid gap-1.5 text-sm font-medium"><span>Department scope</span><NativeSelect value={scopeDepartmentId} onChange={(event) => setScopeDepartmentId(event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</NativeSelect></label><label className="grid gap-1.5 text-sm font-medium"><span>Location scope</span><Input value={scopeLocation} onChange={(event) => setScopeLocation(event.target.value)} placeholder="All locations" /></label><label className="grid gap-1.5 text-sm font-medium"><span>Start date</span><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label><label className="grid gap-1.5 text-sm font-medium"><span>End date</span><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label><div className="md:col-span-2 xl:col-span-5"><Button disabled={pending}>Create scoped cycle</Button></div></form></CardContent></Card>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    <div className="grid gap-6 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]"><Card><CardHeader><CardTitle>Cycles</CardTitle></CardHeader><CardContent className="space-y-2">{cycles.length ? cycles.map((cycle) => <Link key={cycle.id} href={`/audits?cycle=${cycle.id}`} className={`block rounded-md border p-3 transition-colors hover:bg-secondary ${selectedCycle?.id === cycle.id ? "border-primary bg-secondary" : ""}`}><div className="flex items-center justify-between gap-2"><p className="font-medium">{cycle.name}</p><Badge variant={cycle.status === "OPEN" ? "warning" : "secondary"}>{cycle.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(cycle.startDate)} to {formatDate(cycle.endDate)}</p><p className="mt-1 text-xs text-muted-foreground">{cycle._count.items} assets · {cycle._count.assignments} auditors</p></Link>) : <p className="text-sm text-muted-foreground">No audit cycles are available to you.</p>}</CardContent></Card>
      <div className="space-y-6">{selectedCycle ? <><Card><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>{selectedCycle.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{selectedCycle.scopeDepartment?.name ?? "All departments"} · {selectedCycle.scopeLocation ?? "All locations"}</p></div><Badge variant={selectedCycle.status === "OPEN" ? "warning" : "secondary"}>{selectedCycle.status}</Badge></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Period</p><p className="text-sm font-medium">{formatDate(selectedCycle.startDate)} to {formatDate(selectedCycle.endDate)}</p></div><div><p className="text-xs text-muted-foreground">Checked</p><p className="text-sm font-medium">{selectedCycle.items.filter((item) => item.result !== "PENDING").length} / {selectedCycle.items.length}</p></div><div><p className="text-xs text-muted-foreground">Discrepancies</p><p className="text-sm font-medium">{discrepancies.length}</p></div></div></CardContent></Card>
        {isAdmin && selectedCycle.status === "OPEN" && <Card><CardHeader><CardTitle>Assign auditors</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{employees.map((employee) => <label key={employee.id} className="flex items-start gap-2 rounded-md border p-3 text-sm"><input type="checkbox" checked={selectedAuditors.includes(employee.id)} onChange={(event) => setSelectedAuditors((current) => event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id))} /><span><span className="block font-medium">{employee.name}</span><span className="text-xs text-muted-foreground">{employee.email}</span></span></label>)}</div><div className="mt-4 flex flex-wrap items-center gap-3"><Button disabled={pending || !selectedAuditors.length} onClick={assign}>Assign selected</Button><p className="text-sm text-muted-foreground">Current: {selectedCycle.assignments.map((assignment) => assignment.auditor.name).join(", ") || "None"}</p></div></CardContent></Card>}
        <Card><CardHeader><CardTitle>Asset checklist</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Current status</TableHead><TableHead>Audit result</TableHead><TableHead>Notes</TableHead><TableHead>Checked by</TableHead></TableRow></TableHeader><TableBody>{selectedCycle.items.map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.asset.name}</p><p className="text-xs text-muted-foreground">{item.asset.assetTag}{item.asset.location ? ` · ${item.asset.location}` : ""}</p></TableCell><TableCell><Badge variant="outline">{item.asset.status.replaceAll("_", " ")}</Badge></TableCell><TableCell>{isAssigned && selectedCycle.status === "OPEN" ? <NativeSelect className="h-9 w-32" value={item.result} disabled={pending} onChange={(event) => markItem(item.assetId, event.target.value)}><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="MISSING">Missing</option><option value="DAMAGED">Damaged</option></NativeSelect> : <Badge variant={resultVariant(item.result)}>{item.result}</Badge>}</TableCell><TableCell>{isAssigned && selectedCycle.status === "OPEN" ? <Input className="h-9 min-w-40" value={notes[item.assetId] ?? item.notes ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.assetId]: event.target.value }))} placeholder="Optional notes" /> : <span className="text-sm text-muted-foreground">{item.notes ?? "—"}</span>}</TableCell><TableCell>{item.auditor?.name ?? "—"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        {discrepancies.length > 0 && <Card><CardHeader><CardTitle>Discrepancy report</CardTitle></CardHeader><CardContent><ul className="space-y-2">{discrepancies.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"><span><span className="font-medium">{item.asset.assetTag} · {item.asset.name}</span>{item.notes && <span className="ml-2 text-sm text-muted-foreground">{item.notes}</span>}</span><Badge variant={resultVariant(item.result)}>{item.result}</Badge></li>)}</ul></CardContent></Card>}
        {isAdmin && selectedCycle.status === "OPEN" && <Card><CardHeader><CardTitle>Close cycle</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Closing locks this cycle. Missing assets are transitioned to Lost.</p><Button variant="destructive" disabled={pending || selectedCycle.items.some((item) => item.result === "PENDING")} onClick={closeCycle}>Close audit cycle</Button></CardContent></Card>}</> : <Card><CardContent className="p-6 text-sm text-muted-foreground">Choose a cycle to inspect its checklist and discrepancy report.</CardContent></Card>}</div></div>
  </div>;
}
