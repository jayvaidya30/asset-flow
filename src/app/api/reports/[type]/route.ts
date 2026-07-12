import {
  getReport,
  parseReportFilters,
  parseReportType,
  reportToCsv,
} from "@/lib/insights";
import { handle, ok, fail } from "@/lib/api";
import { requireRole } from "@/lib/rbac";

export const GET = handle(async (req, ctx) => {
  const session = await requireRole("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD");
  const { type: rawType } = await ctx.params;
  const type = parseReportType(rawType);
  if (!type) return fail("Unknown report type", 404);

  const url = new URL(req.url);
  const report = await getReport(session, type, parseReportFilters(url.searchParams));

  if (url.searchParams.get("export") === "csv") {
    return new Response(reportToCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}.csv"`,
      },
    });
  }

  return ok(report);
});
