import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { BeneficiaryForm } from "@/components/app/BeneficiaryForm";
import { AttendanceBadge, EmptyState, ErrorBox, LoadingRows } from "@/components/app/common";
import { RegisterInEventDialog } from "@/components/app/RegisterDialogs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { EVENT_TYPE_LABEL, formatDate, formatDateTime } from "@/lib/labels";

export const Route = createFileRoute("/beneficiarios/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Beneficiário · Vida Plena" }] }),
  component: BeneficiaryDetail,
});

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">
        {value === null || value === undefined || value === "" ? "—" : value}
      </p>
    </div>
  );
}

function BeneficiaryDetail() {
  const { id } = Route.useParams();
  const { canEditBeneficiaries, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const detail = useQuery({
    queryKey: ["beneficiary", id],
    queryFn: async () => {
      const [b, history] = await Promise.all([
        supabase.from("v_beneficiaries").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("registrations")
          .select("id, attendance, event_id, events(id, title, event_type, starts_at)")
          .eq("beneficiary_id", id),
      ]);
      if (b.error) throw b.error;
      if (history.error) throw history.error;
      const rows = (history.data ?? []).sort((x, y) =>
        (y.events?.starts_at ?? "").localeCompare(x.events?.starts_at ?? ""),
      );
      return { beneficiary: b.data, history: rows };
    },
  });

  async function remove() {
    const { error } = await supabase.from("beneficiaries").delete().eq("id", id);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Beneficiário e histórico apagados.");
    await queryClient.invalidateQueries();
    void navigate({ to: "/beneficiarios" });
  }

  const b = detail.data?.beneficiary;
  const history = detail.data?.history ?? [];
  const attended = history.filter((h) => h.attendance === "presente").length;
  const active = history.filter((h) => h.attendance !== "cancelado").length;

  return (
    <AppShell
      title={b?.full_name ?? "Beneficiário"}
      actions={
        b && (
          <>
            {canEditBeneficiaries && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-4 w-4" /> Editar
              </Button>
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive">
                    <Trash2 className="mr-1 h-4 w-4" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {b.full_name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação apaga o beneficiário e todo o histórico dele, conforme pedido de
                      eliminação de dados. Não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => void remove()}
                    >
                      Excluir definitivamente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )
      }
    >
      <Link
        to="/beneficiarios"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Beneficiários
      </Link>

      {detail.isError && <ErrorBox />}
      {detail.isLoading && <LoadingRows />}
      {detail.data && !b && <EmptyState>Beneficiário não encontrado.</EmptyState>}

      {b && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Data de nascimento" value={formatDate(b.birth_date)} />
              <Field label="Idade" value={b.age !== null ? `${b.age} anos` : null} />
              <Field label="Região" value={b.region_name} />
              <Field label="Telefone" value={b.phone} />
              <Field label="E-mail" value={b.email} />
              {b.guardian_name && (
                <Field
                  label="Responsável legal"
                  value={`${b.guardian_name} · ${b.guardian_phone ?? ""}`}
                />
              )}
              <Field label="Consentimento registrado em" value={formatDateTime(b.consent_at)} />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Histórico de participação</h2>
              <p className="text-sm text-muted-foreground">
                {active} participação(ões) · {attended} presença(s)
              </p>
            </div>
            <RegisterInEventDialog
              beneficiaryId={id}
              registeredEventIds={history.map((h) => h.event_id)}
              trigger={
                <Button size="sm">
                  <CalendarPlus className="mr-1 h-4 w-4" /> Inscrever em evento
                </Button>
              }
            />
          </div>

          {history.length === 0 ? (
            <EmptyState>Ainda sem participações. Use Inscrever em evento.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/eventos/$id"
                          params={{ id: h.event_id }}
                          className="hover:underline"
                        >
                          {h.events?.title}
                        </Link>
                      </TableCell>
                      <TableCell>{h.events ? EVENT_TYPE_LABEL[h.events.event_type] : ""}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(h.events?.starts_at)}
                      </TableCell>
                      <TableCell>
                        <AttendanceBadge status={h.attendance} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar beneficiário</DialogTitle>
              </DialogHeader>
              <BeneficiaryForm
                initial={{
                  ...(b.id ? { id: b.id } : {}),
                  full_name: b.full_name ?? "",
                  birth_date: b.birth_date ?? "",
                  phone: b.phone ?? "",
                  email: b.email ?? "",
                  region_id: b.region_id ?? "",
                  guardian_name: b.guardian_name ?? "",
                  guardian_phone: b.guardian_phone ?? "",
                }}
                onCancel={() => setEditing(false)}
                onSaved={async () => {
                  await queryClient.invalidateQueries();
                  setEditing(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </AppShell>
  );
}
