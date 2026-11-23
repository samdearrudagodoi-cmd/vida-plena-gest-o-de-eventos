import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type EventType = Database["public"]["Enums"]["event_type"];
export type EventStatus = Database["public"]["Enums"]["event_status"];
export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administração",
  coordenacao: "Coordenação",
  voluntario: "Voluntário",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  inclusao_digital: "Inclusão digital",
  capacitacao_profissional: "Capacitação profissional",
  campanha_saude: "Campanha de saúde",
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  planejado: "Planejado",
  inscricoes_abertas: "Inscrições abertas",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

export const EVENT_STATUS_CLASS: Record<EventStatus, string> = {
  planejado: "bg-slate-100 text-slate-700 border-slate-200",
  inscricoes_abertas: "bg-emerald-100 text-emerald-800 border-emerald-200",
  realizado: "bg-sky-100 text-sky-800 border-sky-200",
  cancelado: "bg-rose-100 text-rose-800 border-rose-200",
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  inscrito: "Inscrito",
  presente: "Presente",
  ausente: "Ausente",
  cancelado: "Cancelado",
};

export const ATTENDANCE_CLASS: Record<AttendanceStatus, string> = {
  inscrito: "bg-slate-100 text-slate-700 border-slate-200",
  presente: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ausente: "bg-amber-100 text-amber-800 border-amber-200",
  cancelado: "bg-rose-100 text-rose-800 border-rose-200",
};

export const EVENT_TYPES = Object.keys(EVENT_TYPE_LABEL) as EventType[];
export const EVENT_STATUSES = Object.keys(EVENT_STATUS_LABEL) as EventStatus[];
export const ATTENDANCE_STATUSES = Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[];

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Datas puras (AAAA-MM-DD) são interpretadas em horário local para não voltar um dia.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

/** Idade em anos completos na data de hoje. Espelha a regra do banco. */
export function ageFromBirthDate(birthDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y = 0, m = 0, d = 0] = birthDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Máscara (11) 99999-9999 / (11) 9999-9999. */
export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (digits.length === 11) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

export function isValidPhone(value: string): boolean {
  const n = value.replace(/\D/g, "").length;
  return n === 10 || n === 11;
}

/** Normaliza nome para comparação: minúsculas, sem acentos, espaços simples. */
export function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Converte valor de <input type="datetime-local"> em ISO, e o inverso. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

export function isoToLocalInput(value: string): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
