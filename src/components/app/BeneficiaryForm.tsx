import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useRegions } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { ageFromBirthDate, formatDate, isValidPhone, maskPhone, normalizeName } from "@/lib/labels";

export type BeneficiaryValues = {
  id?: string;
  full_name: string;
  birth_date: string;
  phone: string;
  email: string;
  region_id: string;
  guardian_name: string;
  guardian_phone: string;
};

export const EMPTY_BENEFICIARY: BeneficiaryValues = {
  full_name: "",
  birth_date: "",
  phone: "",
  email: "",
  region_id: "",
  guardian_name: "",
  guardian_phone: "",
};

export const CONSENT_TEXT =
  "O beneficiário (ou responsável) autoriza o uso destes dados para inscrição e comunicação sobre eventos da ONG Vida Plena.";

type Duplicate = { id: string; full_name: string; birth_date: string };

/** Nomes "parecidos": iguais após normalizar, ou com o mesmo primeiro e último nome. */
function looksSame(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = na.split(" ");
  const tb = nb.split(" ");
  return ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1];
}

export function BeneficiaryForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: BeneficiaryValues;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const editing = Boolean(initial?.id);
  const [values, setValues] = useState<BeneficiaryValues>(initial ?? EMPTY_BENEFICIARY);
  const [consent, setConsent] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const regions = useRegions();

  const age = useMemo(() => ageFromBirthDate(values.birth_date), [values.birth_date]);
  const isMinor = age !== null && age < 18;
  const identityReady = values.full_name.trim().length >= 3 && age !== null;

  const set = <K extends keyof BeneficiaryValues>(key: K, value: BeneficiaryValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Busca antes de cadastrar: mesmo nascimento e nome parecido.
  useEffect(() => {
    if (!identityReady) {
      setDuplicates([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("beneficiaries")
        .select("id, full_name, birth_date")
        .eq("birth_date", values.birth_date)
        .limit(50);
      setDuplicates(
        (data ?? []).filter((d) => d.id !== values.id && looksSame(d.full_name, values.full_name)),
      );
    }, 400);
    return () => clearTimeout(handle);
  }, [identityReady, values.full_name, values.birth_date, values.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (age === null || age < 0 || age > 120) {
      toast.error("Informe uma data de nascimento válida.");
      return;
    }
    if (!isValidPhone(values.phone)) {
      toast.error("Informe o telefone com DDD.");
      return;
    }
    if (!values.region_id) {
      toast.error("Selecione a região.");
      return;
    }
    if (isMinor && (!values.guardian_name.trim() || !isValidPhone(values.guardian_phone))) {
      {
        toast.error("Para menores de 18 anos, informe nome e telefone do responsável legal.");
        return;
      }
    }
    if (!consent) {
      toast.error("O consentimento é obrigatório para o cadastro.");
      return;
    }

    const row = {
      full_name: values.full_name.trim().replace(/\s+/g, " "),
      birth_date: values.birth_date,
      phone: values.phone,
      email: values.email.trim() || null,
      region_id: values.region_id,
      guardian_name: isMinor ? values.guardian_name.trim() : values.guardian_name.trim() || null,
      guardian_phone: isMinor ? values.guardian_phone : values.guardian_phone || null,
    };

    setBusy(true);
    if (editing && values.id) {
      const { error } = await supabase.from("beneficiaries").update(row).eq("id", values.id);
      setBusy(false);
      if (error) {
        toast.error(friendlyError(error, "beneficiary"));
        return;
      }
      toast.success("Cadastro atualizado.");
      onSaved(values.id);
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("beneficiaries")
        .insert({ ...row, consent_given: true, created_by: auth.user?.id ?? null })
        .select("id")
        .single();
      setBusy(false);
      if (error || !data) {
        toast.error(friendlyError(error, "beneficiary"));
        return;
      }
      toast.success("Beneficiário cadastrado.");
      onSaved(data.id);
    }
  }

  const showRest = editing || identityReady;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div className="space-y-2">
          <Label htmlFor="b-name">Nome completo</Label>
          <Input
            id="b-name"
            required
            value={values.full_name}
            onChange={(e) => set("full_name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="b-birth">Data de nascimento</Label>
          <Input
            id="b-birth"
            type="date"
            required
            value={values.birth_date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => set("birth_date", e.target.value)}
          />
          {age !== null && age >= 0 && <p className="text-xs text-muted-foreground">{age} anos</p>}
        </div>
      </div>

      {duplicates.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Possível cadastro duplicado
          </p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Link to="/beneficiarios/$id" params={{ id: d.id }} className="underline">
                  {d.full_name} · {formatDate(d.birth_date)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Confira o cadastro existente antes de continuar.</p>
        </div>
      )}

      {!showRest && (
        <p className="text-sm text-muted-foreground">
          Preencha nome e data de nascimento para verificar se a pessoa já tem cadastro.
        </p>
      )}

      {showRest && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-phone">Telefone</Label>
              <Input
                id="b-phone"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                required
                value={values.phone}
                onChange={(e) => set("phone", maskPhone(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-email">E-mail (opcional)</Label>
              <Input
                id="b-email"
                type="email"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2 sm:max-w-xs">
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

          {isMinor && (
            <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
              <p className="text-sm font-medium">
                Responsável legal (obrigatório para menores de 18 anos)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="b-gname">Nome do responsável</Label>
                  <Input
                    id="b-gname"
                    required
                    value={values.guardian_name}
                    onChange={(e) => set("guardian_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-gphone">Telefone do responsável</Label>
                  <Input
                    id="b-gphone"
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    required
                    value={values.guardian_phone}
                    onChange={(e) => set("guardian_phone", maskPhone(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {!editing && (
            <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <span>{CONSENT_TEXT}</span>
            </label>
          )}

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={busy || (!editing && !consent)}>
              {busy ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
