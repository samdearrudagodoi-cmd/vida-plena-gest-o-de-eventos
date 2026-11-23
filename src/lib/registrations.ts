import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { notifyRegistration } from "@/lib/notify.functions";

/**
 * Cria a inscrição e dispara a notificação. As regras de vaga, status do evento
 * e duplicidade ficam no banco; aqui só traduzimos o retorno.
 * Retorna true se a inscrição foi salva (mesmo que a notificação falhe).
 */
export async function registerBeneficiary(
  beneficiaryId: string,
  eventId: string,
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("registrations")
    .insert({
      beneficiary_id: beneficiaryId,
      event_id: eventId,
      registered_by: auth.user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    toast.error(friendlyError(error, "registration"));
    return false;
  }

  try {
    const result = await notifyRegistration({ data: { registrationId: data.id } });
    if (result.status === "enviado") toast.success("Inscrição salva e notificação enviada.");
    else toast.warning("Inscrição salva. Não foi possível enviar a notificação.");
  } catch {
    toast.warning("Inscrição salva. Não foi possível enviar a notificação.");
  }
  return true;
}
