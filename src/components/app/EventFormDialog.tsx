import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useRegions } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import {
  EVENT_STATUSES,
  EVENT_STATUS_LABEL,
  EVENT_TYPES,
  EVENT_TYPE_LABEL,
  isoToLocalInput,
  localInputToIso,
  type EventStatus,
  type EventType,
} from "@/lib/labels";

export type EventFormValues = {
  id?: string;
  title: string;
  event_type: EventType | "";
  description: string;
  starts_at: string; // valor de datetime-local
  location: string;
  region_id: string;
  capacity: string;
  status: EventStatus;
};

const EMPTY: EventFormValues = {
  title: "",
  event_type: "",
  description: "",
  starts_at: "",
  location: "",
  region_id: "",
  capacity: "",
  status: "planejado",
};

export function eventToFormValues(e: {
  id: string;
  title: string;
  event_type: EventType;
  description: string | null;
  starts_at: string;
  location: string;
  region_id: string;
  capacity: number;
  status: EventStatus;
}): EventFormValues {
  return {
    id: e.id,
    title: e.title,
    event_type: e.event_type,
    description: e.description ?? "",
    starts_at: isoToLocalInput(e.starts_at),
    location: e.location,
    region_id: e.region_id,
    capacity: String(e.capacity),
    status: e.status,
  };
}

export function EventFormDialog({
  trigger,
  initial,
}: {
  trigger: ReactNode;
  initial?: EventFormValues;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<EventFormValues>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const regions = useRegions();
  const queryClient = useQueryClient();
  const editing = Boolean(initial?.id);

  useEffect(() => {
    if (open) setValues(initial ?? EMPTY);
  }, [open, initial]);

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const capacity = Number(values.capacity);
    if (!values.event_type || !values.region_id || !values.starts_at) {
      {
        toast.error("Preencha tipo, data e região.");
        return;
      }
    }
    if (!Number.isInteger(capacity) || capacity <= 0) {
      toast.error("A capacidade precisa ser um número maior que zero.");
      return;
    }

    const row = {
      title: values.title.trim(),
      event_type: values.event_type,
      description: values.description.trim() || null,
      starts_at: localInputToIso(values.starts_at),
      location: values.location.trim(),
      region_id: values.region_id,
      capacity,
      status: values.status,
    };

    setBusy(true);
    let error;
    if (editing && values.id) {
      ({ error } = await supabase.from("events").update(row).eq("id", values.id));
    } else {
      const { data: auth } = await supabase.auth.getUser();
      ({ error } = await supabase
        .from("events")
        .insert({ ...row, created_by: auth.user?.id ?? null }));
    }
    setBusy(false);

    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(editing ? "Evento atualizado." : "Evento cadastrado.");
    await queryClient.invalidateQueries();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ev-title">Título</Label>
            <Input
              id="ev-title"
              required
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={values.event_type}
                onValueChange={(v) => set("event_type", v as EventType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EVENT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={values.status} onValueChange={(v) => set("status", v as EventStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {EVENT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ev-date">Data e hora</Label>
              <Input
                id="ev-date"
                type="datetime-local"
                required
                value={values.starts_at}
                onChange={(e) => set("starts_at", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-cap">Capacidade (vagas)</Label>
              <Input
                id="ev-cap"
                type="number"
                min={1}
                step={1}
                required
                value={values.capacity}
                onChange={(e) => set("capacity", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ev-loc">Local</Label>
              <Input
                id="ev-loc"
                required
                value={values.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Região</Label>
              <Select value={values.region_id} onValueChange={(v) => set("region_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(regions.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-desc">Descrição (opcional)</Label>
            <Textarea
              id="ev-desc"
              rows={3}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
