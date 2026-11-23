import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, ErrorBox, EventStatusBadge } from "@/components/app/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_TYPE_LABEL, formatDateTime } from "@/lib/labels";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel · Vida Plena" }] }),
  component: Dashboard,
});

function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [beneficiaries, events, impact] = await Promise.all([
        supabase.from("beneficiaries").select("id", { count: "exact", head: true }),
        supabase.from("v_event_summary").select("*"),
        supabase.from("v_impact_by_region").select("*").order("region_name"),
      ]);
      if (beneficiaries.error) throw beneficiaries.error;
      if (events.error) throw events.error;
      if (impact.error) throw impact.error;

      const allEvents = events.data ?? [];
      const done = allEvents.filter((e) => e.status === "realizado");
      const doneRegistered = done.reduce((s, e) => s + (e.registered ?? 0), 0);
      const doneAttended = done.reduce((s, e) => s + (e.attended ?? 0), 0);
      const now = new Date().toISOString();

      return {
        totalBeneficiaries: beneficiaries.count ?? 0,
        openEvents: allEvents.filter((e) => e.status === "inscricoes_abertas").length,
        totalAttended: (impact.data ?? []).reduce((s, r) => s + (r.total_attended ?? 0), 0),
        attendanceRate:
          doneRegistered > 0 ? Math.round((doneAttended / doneRegistered) * 100) : null,
        byRegion: (impact.data ?? []).map((r) => ({
          region: r.region_name ?? "",
          presencas: r.total_attended ?? 0,
          atendidos: r.beneficiaries_served ?? 0,
        })),
        upcoming: allEvents
          .filter(
            (e) =>
              (e.starts_at ?? "") >= now &&
              (e.status === "planejado" || e.status === "inscricoes_abertas"),
          )
          .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))
          .slice(0, 5),
      };
    },
  });
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>}
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading, isError } = useDashboard();

  return (
    <AppShell title="Painel">
      {isError && <ErrorBox />}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando indicadores…</p>}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Beneficiários cadastrados" value={data.totalBeneficiaries} />
            <Stat label="Eventos com inscrições abertas" value={data.openEvents} />
            <Stat label="Participações com presença" value={data.totalAttended} />
            <Stat
              label="Taxa de presença"
              value={data.attendanceRate === null ? "—" : `${data.attendanceRate}%`}
              hint="Presentes ÷ inscritos, nos eventos já realizados."
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">Participações com presença por região</CardTitle>
              </CardHeader>
              <CardContent>
                {data.totalAttended === 0 ? (
                  <EmptyState>Ainda não há presenças registradas.</EmptyState>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.byRegion}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="region"
                          tick={{ fontSize: 11 }}
                          interval={0}
                          angle={-25}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(v: number, name: string) => [
                            v,
                            name === "presencas" ? "Presenças" : "Beneficiários atendidos",
                          ]}
                        />
                        <Bar
                          dataKey="presencas"
                          fill="var(--color-primary)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Próximos eventos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.upcoming.length === 0 && (
                  <EmptyState>Nenhum evento futuro. Cadastre em Eventos.</EmptyState>
                )}
                {data.upcoming.map((e) => (
                  <Link
                    key={e.id}
                    to="/eventos/$id"
                    params={{ id: e.id ?? "" }}
                    className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{e.title}</p>
                      <EventStatusBadge status={e.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.event_type ? EVENT_TYPE_LABEL[e.event_type] : ""} ·{" "}
                      {formatDateTime(e.starts_at)} · {e.region_name}
                    </p>
                    <p className="mt-1 text-xs font-medium">
                      {e.remaining} de {e.capacity} vagas restantes
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
