import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import {
  EmptyState,
  ErrorBox,
  EventStatusBadge,
  LoadingRows,
  NotificationIcon,
} from "@/components/app/common";
import { EventFormDialog, eventToFormValues } from "@/components/app/EventFormDialog";
import { RegisterBeneficiaryDialog } from "@/components/app/RegisterDialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_STATUSES,
  EVENT_TYPE_LABEL,
  formatDateTime,
  type AttendanceStatus,
} from "@/lib/labels";

export const Route = createFileRoute("/eventos/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Evento · Vida Plena" }] }),
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const { canManageEvents } = useAuth();
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const [event, summary, registrations] = await Promise.all([
        supabase.from("events").select("*, regions(name)").eq("id", id).maybeSingle(),
        supabase
          .from("v_event_summary")
          .select("registered, attended, remaining")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("registrations")
          .select(
            "id, attendance, registered_at, beneficiary_id, beneficiaries(full_name), notifications(status, sent_at, error_message)",
          )
          .eq("event_id", id)
          .order("registered_at"),
      ]);
      if (event.error) throw event.error;
      if (summary.error) throw summary.error;
      if (registrations.error) throw registrations.error;
      return { event: event.data, summary: summary.data, registrations: registrations.data ?? [] };
    },
  });

  async function changeAttendance(
    registrationId: string,
    current: AttendanceStatus,
    next: AttendanceStatus,
  ) {
    const remaining = detail.data?.summary?.remaining ?? 0;
    // Reativar uma inscrição cancelada ocupa vaga de novo.
    if (current === "cancelado" && next !== "cancelado" && remaining <= 0) {
      {
        toast.error("Evento sem vagas disponíveis.");
        return;
      }
    }
    const { error } = await supabase
      .from("registrations")
      .update({ attendance: next })
      .eq("id", registrationId);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(`Situação alterada para ${ATTENDANCE_LABEL[next]}.`);
    await queryClient.invalidateQueries();
  }

  const event = detail.data?.event;
  const summary = detail.data?.summary;
  const acceptsRegistrations =
    event &&
    event.status !== "cancelado" &&
    event.status !== "realizado" &&
    (summary?.remaining ?? 0) > 0;
  const registrations = detail.data?.registrations ?? [];
  const registeredIds = registrations.map((r) => r.beneficiary_id);

  return (
    <AppShell
      title={event?.title ?? "Evento"}
      actions={
        event &&
        canManageEvents && (
          <EventFormDialog
            initial={eventToFormValues(event)}
            trigger={
              <Button size="sm" variant="outline">
                <Pencil className="mr-1 h-4 w-4" /> Editar
              </Button>
            }
          />
        )
      }
    >
      <Link
        to="/eventos"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Eventos
      </Link>

      {detail.isError && <ErrorBox />}
      {detail.isLoading && <LoadingRows />}
      {detail.data && !event && <EmptyState>Evento não encontrado.</EmptyState>}

      {event && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{EVENT_TYPE_LABEL[event.event_type]}</CardTitle>
                  <EventStatusBadge status={event.status} />
                </div>
                <CardDescription>
                  {formatDateTime(event.starts_at)} · {event.location} · {event.regions?.name}
                </CardDescription>
              </CardHeader>
              {event.description && (
                <CardContent className="text-sm whitespace-pre-line">
                  {event.description}
                </CardContent>
              )}
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vagas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{summary?.registered ?? 0}</p>
                  <p className="text-xs text-muted-foreground">inscritos</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{summary?.attended ?? 0}</p>
                  <p className="text-xs text-muted-foreground">presentes</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{summary?.remaining ?? 0}</p>
                  <p className="text-xs text-muted-foreground">restantes de {event.capacity}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Inscritos</h2>
            <RegisterBeneficiaryDialog
              eventId={event.id}
              registeredIds={registeredIds}
              trigger={
                <Button
                  size="sm"
                  disabled={!acceptsRegistrations}
                  title={
                    acceptsRegistrations ? undefined : "Evento sem vagas, cancelado ou realizado"
                  }
                >
                  <UserPlus className="mr-1 h-4 w-4" /> Inscrever beneficiário
                </Button>
              }
            />
          </div>

          {registrations.length === 0 ? (
            <EmptyState>Nenhuma inscrição neste evento.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiário</TableHead>
                    <TableHead>Inscrito em</TableHead>
                    <TableHead className="w-44">Situação</TableHead>
                    <TableHead className="w-24 text-center">Notificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/beneficiarios/$id"
                          params={{ id: r.beneficiary_id }}
                          className="hover:underline"
                        >
                          {r.beneficiaries?.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(r.registered_at)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.attendance}
                          onValueChange={(v) =>
                            void changeAttendance(r.id, r.attendance, v as AttendanceStatus)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {ATTENDANCE_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <NotificationIcon rows={r.notifications} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
