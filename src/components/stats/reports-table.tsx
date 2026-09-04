"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteReport, getStatFileUrl } from "@/app/statistici/actions";
import { PERIOD_TYPE_LABEL, kindLabel } from "@/lib/stats/labels";
import type { StatReport } from "@/lib/types";

/**
 * Deschide sursa .xlsx într-o filă nouă.
 *
 * Fila se deschide sincron, în gestul utilizatorului: linkul semnat vine abia
 * după un await, iar un `window.open` de acolo ar fi blocat ca pop-up. Aceeași
 * șmecherie ca la atașamentele petițiilor.
 */
async function openReportFile(path: string, fileName: string | null): Promise<void> {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null; // fără acces înapoi la fereastra noastră
  const { url, error } = await getStatFileUrl(path, fileName ?? undefined);
  if (error || !url) {
    tab?.close();
    toast.error(error ?? "Nu s-a putut deschide fișierul.");
    return;
  }
  if (tab) tab.location.replace(url);
  else window.open(url, "_blank", "noopener,noreferrer"); // fallback
}

interface ReportsTableProps {
  reports: StatReport[];
  isAdmin: boolean;
}

export function ReportsTable({ reports, isAdmin }: ReportsTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleDelete = (report: StatReport) => {
    if (!window.confirm("Ștergi acest raport? Se pierd și valorile lui.")) return;
    startTransition(async () => {
      const res = await deleteReport(report.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Raport șters");
      router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Antet */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-3.5 py-2 text-[11px] font-medium text-muted-foreground">
        <span className="min-w-0 flex-1">Raport</span>
        <span className="w-32 shrink-0">Perioada</span>
        <span className="w-28 shrink-0">Tip perioadă</span>
        <span className="w-28 shrink-0 text-right">Indicatori</span>
        <span className="w-32 shrink-0">Importat</span>
        <span className="w-8 shrink-0" aria-hidden />
      </div>

      {reports.length ? (
        <div className="divide-y">
          {reports.map((report) => {
            // Într-o constantă locală, ca îngustarea să țină și în callback.
            const filePath = report.file_path;
            return (
            <div
              key={report.id}
              className="flex items-center gap-3 px-3.5 py-2 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{kindLabel(report.kind)}</div>
                {report.file_name && (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {report.file_name}
                  </div>
                )}
              </div>

              <div className="w-32 shrink-0 text-[13px]">
                {format(parseISO(report.period_date), "d MMM yyyy")}
              </div>

              <div className="w-28 shrink-0">
                <Badge variant="secondary" className="font-normal">
                  {PERIOD_TYPE_LABEL[report.period_type]}
                </Badge>
              </div>

              <div className="w-28 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">
                {report.values_count ?? 0}
              </div>

              <div className="w-32 shrink-0 text-[13px] text-muted-foreground">
                {format(parseISO(report.created_at), "d MMM yyyy")}
              </div>

              <div className="flex w-8 shrink-0 justify-end">
                {isAdmin ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Acțiuni</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {filePath && (
                        <DropdownMenuItem
                          onSelect={() => {
                            void openReportFile(filePath, report.file_name);
                          }}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Deschide
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => handleDelete(report)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Șterge
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-12 text-center text-muted-foreground">Niciun raport importat.</div>
      )}
    </div>
  );
}
