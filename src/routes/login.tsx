import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar · Vida Plena" }] }),
  component: LoginPage,
});

function authErrorMessage(message: string): string {
  console.warn("[auth]", message);
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar.";
  if (/already registered/i.test(message)) return "Este e-mail já tem conta. Use a aba Entrar.";
  if (/weak|pwned|leaked|known to be|easy to guess/i.test(message))
    return "Esta senha é fraca ou já apareceu em vazamentos de dados. Escolha outra, com letras, números e símbolos.";
  if (/at least \d+ characters|too short/i.test(message)) {
    const n = /at least (\d+)/i.exec(message)?.[1] ?? "6";
    return `A senha precisa ter pelo menos ${n} caracteres.`;
  }
  if (/should contain|must contain|characters? of each/i.test(message))
    return "A senha precisa misturar letras maiúsculas, minúsculas, números e símbolos.";
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (/signups not allowed|signup.*disabled/i.test(message))
    return "A criação de contas está desativada.";
  // Motivo não mapeado: mostra o texto original para não esconder a causa.
  return `Não foi possível concluir: ${message}`;
}

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(authErrorMessage(error.message));
  }

  async function signUp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
    if (!data.session) toast.success("Conta criada. Confirme pelo link enviado ao seu e-mail.");
    else toast.success("Conta criada. Aguarde a liberação do acesso pela coordenação.");
  }

  const fields = (
    <>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <CardTitle>Vida Plena · Gestão de Eventos</CardTitle>
          <CardDescription>Acesso restrito à equipe da ONG.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="entrar">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="criar">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="entrar">
              <form onSubmit={signIn} className="mt-4 space-y-4">
                {fields}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="criar">
              <form onSubmit={signUp} className="mt-4 space-y-4">
                {fields}
                <p className="text-xs text-muted-foreground">
                  Novas contas só acessam os dados depois que a coordenação libera um perfil.
                </p>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Criando…" : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
