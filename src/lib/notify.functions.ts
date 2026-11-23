import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ registrationId: z.string().uuid() });

export type NotifyResult = { status: "enviado" | "falhou"; error?: string };

/**
 * notify-registration
 * Lê a inscrição com o login de quem chamou (a RLS confirma o acesso), envia ao
 * webhook do Make só os campos do contrato de dados e grava o resultado em
 * notifications com o cliente de servidor. O segredo MAKE_WEBHOOK_URL nunca
 * chega ao navegador.
 */
export const notifyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<NotifyResult> => {
    const { data: reg, error } = await context.supabase
      .from("registrations")
      .select(
        "id, beneficiaries(full_name, email), events(title, event_type, starts_at, location, regions(name))",
      )
      .eq("id", data.registrationId)
      .maybeSingle();

    if (error || !reg) {
      throw new Error("Inscrição não encontrada ou sem permissão.");
    }

    const beneficiary = reg.beneficiaries;
    const event = reg.events;

    // Contrato de dados: sem telefone e sem data de nascimento (princípio da necessidade).
    const payload = {
      registration_id: reg.id,
      beneficiary_name: beneficiary?.full_name ?? null,
      beneficiary_email: beneficiary?.email ?? null,
      event_title: event?.title ?? null,
      event_type: event?.event_type ?? null,
      event_starts_at: event?.starts_at ? new Date(event.starts_at).toISOString() : null,
      event_location: event?.location ?? null,
      region: event?.regions?.name ?? null,
    };

    let result: NotifyResult;
    const webhookUrl = process.env["MAKE_WEBHOOK_URL"];

    if (!webhookUrl) {
      result = {
        status: "falhou",
        error: "Webhook de notificação não configurado (MAKE_WEBHOOK_URL).",
      };
    } else {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        result = response.ok
          ? { status: "enviado" }
          : { status: "falhou", error: `Webhook respondeu HTTP ${response.status}.` };
      } catch (e) {
        result = {
          status: "falhou",
          error: e instanceof Error ? e.message.slice(0, 300) : "Erro de rede.",
        };
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      registration_id: reg.id,
      channel: "email",
      status: result.status,
      error_message: result.error ?? null,
    });

    return result;
  });
