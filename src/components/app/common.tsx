import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_LABEL,
  EVENT_STATUS_CLASS,
  EVENT_STATUS_LABEL,
  formatDateTime,
  type AttendanceStatus,
  type EventStatus,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

export function EventStatusBadge({ status }: { status: EventStatus | null }) {
  if (!status) return null;
  return (
    <Badge variant="outline" className={cn("font-medium", EVENT_STATUS_CLASS[status])}>
      {EVENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ATTENDANCE_CLASS[status])}>
      {ATTENDANCE_LABEL[status]}
    </Badge>
  );
}

type NotificationRow = { status: string; sent_at: string | null; error_message: string | null };

/** Última notificação da inscrição: enviada, falhou ou sem registro. */
export function latestNotification(
  rows: NotificationRow[] | null | undefined,
): NotificationRow | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""))[0] ?? null;
}

export function NotificationIcon({ rows }: { rows: NotificationRow[] | null | undefined }) {
  const last = latestNotification(rows);
  let icon: ReactNode;
  let text: string;
  if (!last) {
    icon = <CircleDashed className="h-4 w-4 text-muted-foreground" />;
    text = "Sem registro de notificação";
  } else if (last.status === "enviado") {
    icon = <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    text = `Notificação enviada em ${formatDateTime(last.sent_at)}`;
  } else {
    icon = <XCircle className="h-4 w-4 text-rose-600" />;
    text = `Notificação falhou em ${formatDateTime(last.sent_at)}`;
  }
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" aria-label={text}>
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("regions").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-background p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function LoadingRows() {
  return (
    <div className="rounded-lg border bg-background p-10 text-center text-sm text-muted-foreground">
      Carregando…
    </div>
  );
}

export function ErrorBox() {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
      Não foi possível carregar os dados. Recarregue a página.
    </div>
  );
}
