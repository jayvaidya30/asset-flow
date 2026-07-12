import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getReport,
  getReportFilterOptions,
  parseReportType,
  type ReportType,
} from "@/lib/insights";
import { hasRole } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const REPORTS: { type: ReportType; label: string }[] = [
  { type: "allocation-summary", label: "Allocation Summary" },
  { type: "maintenance-frequency", label: "Maintenance Frequency" },
  { type: "asset-utilization", label: "Asset Utilization" },
  { type: "booking-heatmap", label: "Booking Heatmap" },
  { type: "overdue-returns", label: "Overdue Returns" },
];

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD")) redirect("/dashboard");

  const params = await searchParams;
  const reportType = parseReportType(getParam(params, "type") ?? "") ?? "allocation-summary";
  const selectedDepartment = getParam(params, "departmentId") ?? "";
  const selectedCategory = getParam(params, "categoryId") ?? "";
  const from = getParam(params, "from") ?? "";
  const to = getParam(params, "to") ?? "";

  const [options, report] = await Promise.all([
    getReportFilterOptions(session),
    getReport(session, reportType, {
      departmentId: selectedDepartment || undefined,
      categoryId: selectedCategory || undefined,
      from: from ? new Date(`${from}T00:00:00`) : undefined,
      to: to ? new Date(`${to}T23:59:59`) : undefined,
    }),
  ]);

  const exportHref = `/api/reports/${reportType}?${new URLSearchParams({
    ...(selectedDepartment ? { departmentId: selectedDepartment } : {}),
    ...(selectedCategory ? { categoryId: selectedCategory } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    export: "csv",
  }).toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">{report.description}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={exportHref}>Export CSV</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-4 md:grid-cols-5" action="/reports">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">Report</span>
              <NativeSelect name="type" defaultValue={reportType}>
                {REPORTS.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">Department</span>
              <NativeSelect name="departmentId" defaultValue={selectedDepartment}>
                <option value="">All departments</option>
                {options.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">Category</span>
              <NativeSelect name="categoryId" defaultValue={selectedCategory}>
                <option value="">All categories</option>
                {options.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">From</span>
              <Input type="date" name="from" defaultValue={from} />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">To</span>
              <Input type="date" name="to" defaultValue={to} />
            </label>
            <div className="md:col-span-5">
              <Button type="submit" size="sm">
                Apply Filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{report.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {report.columns.map((column) => (
                    <TableHead key={column.key} className={column.align === "right" ? "text-right" : ""}>
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row, index) => (
                  <TableRow key={index}>
                    {report.columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={column.align === "right" ? "text-right tabular-nums" : ""}
                      >
                        {row[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No rows match the selected filters.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}
