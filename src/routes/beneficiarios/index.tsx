import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, ErrorBox, LoadingRows, useRegions } from "@/components/app/common";
import { Button } from "@/components/ui/button";
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
import { normalizeName } from "@/lib/labels";

export const Route = createFileRoute("/beneficiarios/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Beneficiários · Vida Plena" }] }),
  component: BeneficiariesPage,
});

const ALL = "todas";

function BeneficiariesPage() {
  const regions = useRegions();
  const [term, setTerm] = useState("");
  const [region, setRegion] = useState(ALL);

  const list = useQuery({
    queryKey: ["beneficiaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_beneficiaries")
        .select("id, full_name, age, region_id, region_name, total_registrations, total_attended")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const t = normalizeName(term);
    return (list.data ?? []).filter(
      (b) =>
        (!t || normalizeName(b.full_name ?? "").includes(t)) &&
        (region === ALL || b.region_id === region),
    );
  }, [list.data, term, region]);

  return (
    <AppShell
      title="Beneficiários"
      actions={
        <Button size="sm" asChild>
          <Link to="/beneficiarios/novo">
            <Plus className="mr-1 h-4 w-4" /> Novo beneficiário
          </Link>
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_240px]">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
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

      {list.isError && <ErrorBox />}
      {list.isLoading && <LoadingRows />}
      {list.data && list.data.length === 0 && (
        <EmptyState>Nenhum beneficiário cadastrado. Clique em Novo beneficiário.</EmptyState>
      )}
      {list.data && list.data.length > 0 && rows.length === 0 && (
        <EmptyState>Ninguém encontrado com esses filtros.</EmptyState>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Idade</TableHead>
                <TableHead>Região</TableHead>
                <TableHead className="text-right">Participações</TableHead>
                <TableHead className="text-right">Presenças</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/beneficiarios/$id"
                      params={{ id: b.id ?? "" }}
                      className="hover:underline"
                    >
                      {b.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.age}</TableCell>
                  <TableCell>{b.region_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.total_registrations}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.total_attended}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{rows.length} beneficiário(s)</p>
    </AppShell>
  );
}
