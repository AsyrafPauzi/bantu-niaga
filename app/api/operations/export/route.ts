import { buildOperationsExportCsv } from "@/lib/operations/export";
import { notifyOperationsExportDownloaded } from "@/lib/operations/notify";
import { requireOperationsUser } from "@/lib/operations/require-user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const csv = await buildOperationsExportCsv(user.businessId, { from, to });
  notifyOperationsExportDownloaded({ businessId: user.businessId });
  const filename = `operations-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
