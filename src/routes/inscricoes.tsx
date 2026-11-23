import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import {
  AttendanceBadge,
  EmptyState,
  ErrorBox,
  LoadingRows,
  NotificationIcon,
  useRegions,
} from "@/components/app/common";
import { Input } from "@/components/ui/input";
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
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, formatDateTime, normalizeName } from "@/lib/labels";

export const Route = createFileRoute("/inscricoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inscrições · Vida Plena" }] }),
  component: RegistrationsPage,
});

const ALL = "todos";

function RegistrationsPage() {
  const regions = useRegions();
  const [term, setTerm] = useState("");
  const [eventId, setEventId] = useState(ALL);
  const [region, setRegion] = useState(ALL);
  const [attendance, setAttendance] = useState(ALL);

  const list = useQuery({
    queryKey: ["registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select(
          "id, attendance, registered_at, beneficiary_id, event_id, beneficiaries(full_name), events(title, starts_at, region_id, regions(name)), notifications(status, sent_at, error_message)",
        )
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const eventOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of list.data ?? []) if (r.events) map.set(r.event_id, r.events.title);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [list.data]);

  const rows = useMemo(() => {
    const t = normalizeName(term);
    return (list.data ?? []).filter(
      (r) =>
        (!t || normalizeName(r.beneficiaries?.full_name ?? "").includes(t)) &&
        (eventId === ALL || r.event_id === eventId) &&
        (region === ALL || r.events?.region_id === region) &&
        (attendance === ALL || r.attendance === attendance),
    );
  }, [list.data, term, eventId, region, attendance]);

  return (
    <AppShell title="Inscrições">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar beneficiário"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os eventos</SelectItem>
            {eventOptions.map(([id, title]) => (
              <SelectItem key={id} value={id}>
                {title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as regiões</SelectItem>
            {(regions.data ?? []).map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={attendance} onValueChange={setAttendance}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as situações</SelectItem>
            {ATTENDANCE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ATTENDANCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isError && <ErrorBox />}
      {list.isLoading && <LoadingRows />}
      {list.data && list.data.length === 0 && (
        <EmptyState>
          Nenhuma inscrição ainda. Inscreva beneficiários pela página do evento.
        </EmptyState>
      )}
      {list.data && list.data.length > 0 && rows.length === 0 && (
        <EmptyState>Nenhuma inscrição com esses filtros.</EmptyState>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Beneficiário</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Data do evento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-center">Notificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
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
                  <TableCell>
                    <Link to="/eventos/$id" params={{ id: r.event_id }} className="hover:underline">
                      {r.events?.title}
                    </Link>
                  </TableCell>
                  <TableCell>{r.events?.regions?.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(r.events?.starts_at)}
                  </TableCell>
                  <TableCell>
                    <AttendanceBadge status={r.attendance} />
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
      <p className="mt-3 text-xs text-muted-foreground">{rows.length} inscrição(ões)</p>
    </AppShell>
  );
}
