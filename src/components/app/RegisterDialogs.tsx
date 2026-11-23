import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_TYPE_LABEL, formatDate, formatDateTime } from "@/lib/labels";
import { registerBeneficiary } from "@/lib/registrations";

/** A partir de um evento: busca o beneficiário por nome e inscreve. */
export function RegisterBeneficiaryDialog({
  eventId,
  registeredIds,
  trigger,
}: {
  eventId: string;
  registeredIds: string[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const search = term.trim();
  const results = useQuery({
    queryKey: ["beneficiary-search", search],
    enabled: open && search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_beneficiaries")
        .select("id, full_name, birth_date, region_name")
        .ilike("full_name", `%${search.replace(/[%_]/g, "")}%`)
        .order("full_name")
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  async function register(beneficiaryId: string) {
    setBusyId(beneficiaryId);
    const ok = await registerBeneficiary(beneficiaryId, eventId);
    setBusyId(null);
    if (ok) {
      await queryClient.invalidateQueries();
      setOpen(false);
      setTerm("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Inscrever beneficiário</DialogTitle>
          <DialogDescription>
            Busque pelo nome. Se a pessoa não tiver cadastro, cadastre em Beneficiários.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-9"
            placeholder="Digite ao menos 2 letras"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {search.length >= 2 && results.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum beneficiário encontrado.
            </p>
          )}
          {(results.data ?? []).map((b) => {
            const already = b.id ? registeredIds.includes(b.id) : false;
            return (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(b.birth_date)} · {b.region_name}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={already || busyId !== null}
                  onClick={() => b.id && void register(b.id)}
                >
                  {already ? "Já inscrito" : busyId === b.id ? "Inscrevendo…" : "Inscrever"}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A partir de um beneficiário: lista eventos com inscrições abertas e vagas. */
export function RegisterInEventDialog({
  beneficiaryId,
  registeredEventIds,
  trigger,
}: {
  beneficiaryId: string;
  registeredEventIds: string[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const events = useQuery({
    queryKey: ["open-events"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_event_summary")
        .select("id, title, event_type, starts_at, location, region_name, remaining")
        .eq("status", "inscricoes_abertas")
        .gt("remaining", 0)
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  const available = (events.data ?? []).filter((e) => e.id && !registeredEventIds.includes(e.id));

  async function register(eventId: string) {
    setBusyId(eventId);
    const ok = await registerBeneficiary(beneficiaryId, eventId);
    setBusyId(null);
    if (ok) {
      await queryClient.invalidateQueries();
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Inscrever em evento</DialogTitle>
          <DialogDescription>
            Somente eventos com inscrições abertas e vagas disponíveis.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {events.isLoading && (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
          )}
          {!events.isLoading && available.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum evento disponível para inscrição.
            </p>
          )}
          {available.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {e.event_type ? EVENT_TYPE_LABEL[e.event_type] : ""} ·{" "}
                  {formatDateTime(e.starts_at)} · {e.region_name} · {e.remaining} vaga(s)
                </p>
              </div>
              <Button
                size="sm"
                disabled={busyId !== null}
                onClick={() => e.id && void register(e.id)}
              >
                {busyId === e.id ? "Inscrevendo…" : "Inscrever"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
