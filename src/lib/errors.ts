type DbError = { code?: string; message?: string } | null | undefined;

// Mensagens levantadas pelos triggers do banco, que já estão em português.
const TRIGGER_MESSAGES = [
  "Evento sem vagas disponíveis",
  "Evento não aceita inscrições",
  "Consentimento obrigatório para cadastro",
  "Menores de 18 anos exigem nome e telefone do responsável",
];

/** Traduz o erro do banco para uma frase curta, sem detalhes técnicos. */
export function friendlyError(error: DbError, context?: "beneficiary" | "registration"): string {
  if (!error) return "Não foi possível concluir a operação.";
  const message = error.message ?? "";

  const trigger = TRIGGER_MESSAGES.find((m) => message.includes(m));
  if (trigger) return trigger + ".";

  switch (error.code) {
    case "23505":
      if (context === "registration") return "Este beneficiário já está inscrito neste evento.";
      if (context === "beneficiary")
        return "Já existe um beneficiário com este nome e esta data de nascimento.";
      return "Este registro já existe.";
    case "23503":
      return "Este registro está ligado a outros dados e não pode ser removido.";
    case "42501":
      return "Seu perfil não tem permissão para esta ação.";
    case "23514":
      return "Algum valor informado não é válido.";
    default:
      break;
  }

  if (/row-level security/i.test(message)) return "Seu perfil não tem permissão para esta ação.";
  if (/fetch|network/i.test(message)) return "Sem conexão com o servidor. Tente novamente.";
  return "Não foi possível concluir a operação.";
}
