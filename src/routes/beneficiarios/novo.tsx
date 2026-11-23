import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { BeneficiaryForm } from "@/components/app/BeneficiaryForm";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/beneficiarios/novo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Novo beneficiário · Vida Plena" }] }),
  component: NewBeneficiary,
});

function NewBeneficiary() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <AppShell title="Novo beneficiário">
      <Link
        to="/beneficiarios"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Beneficiários
      </Link>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <BeneficiaryForm
            onCancel={() => void navigate({ to: "/beneficiarios" })}
            onSaved={async (id) => {
              await queryClient.invalidateQueries();
              void navigate({ to: "/beneficiarios/$id", params: { id } });
            }}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
