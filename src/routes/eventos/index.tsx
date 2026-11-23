import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import {
  EmptyState,
  ErrorBox,
  EventStatusBadge,
  LoadingRows,
  useRegions,
} from "@/components/app/common";
import { EventFormDialog } from "@/components/app/EventFormDialog";
import { Button } from "@/components/ui/button";
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
import {
  EVENT_STATUSES,
  EVENT_STATUS_LABEL,
  EVENT_TYPES,
  EVENT_TYPE_LABEL,
  formatDateTime,
} from "@/lib/labels";

export const Route = createFileRoute("/eventos/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Eventos · Vida Plena" }] }),
  component: EventsPage,
});

const ALL = "todos";

function EventsPage() {
  const { canManageEvents } = useAuth();
  const regions = useRegions();
  const [type, setType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [region, setRegion] = useState(ALL);

  const events = useQuery({
    queryKey: ["events-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_event_summary")
        .select("*")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(
    () =>
      (events.data ?? []).filter(
        (e) =>
          (type === ALL || e.event_type === type) &&
          (status === ALL || e.status === status) &&
          (region === ALL || e.region_id === region),
      ),
    [events.data, type, status, region],
  );

  return (
    <AppShell
      title="Eventos"
      actions={
        canManageEvents && (
          <EventFormDialog
            trigger={
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Novo evento
              </Button>
            }
          />
        )
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {EVENT_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {EVENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {EVENT_STATUS_LABEL[s]}
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
      </div>

      {events.isError && <ErrorBox />}
      {events.isLoading && <LoadingRows />}
      {events.data && events.data.length === 0 && (
        <EmptyState>
          {canManageEvents
            ? "Nenhum evento cadastrado. Clique em Novo evento."
            : "Nenhum evento cadastrado ainda."}
        </EmptyState>
      )}
      {events.data && events.data.length > 0 && rows.length === 0 && (
        <EmptyState>Nenhum evento com esses filtros.</EmptyState>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Inscritos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    <Link to="/eventos/$id" params={{ id: e.id ?? "" }} className="hover:underline">
                      {e.title}
                    </Link>
                  </TableCell>
                  <TableCell>{e.event_type ? EVENT_TYPE_LABEL[e.event_type] : ""}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(e.starts_at)}</TableCell>
                  <TableCell>
                    {e.location} <span className="text-muted-foreground">· {e.region_name}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.registered}/{e.capacity}
                  </TableCell>
                  <TableCell>
                    <EventStatusBadge status={e.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
