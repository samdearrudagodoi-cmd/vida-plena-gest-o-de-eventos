import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardList,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/eventos", label: "Eventos", icon: CalendarDays },
  { to: "/beneficiarios", label: "Beneficiários", icon: Users },
  { to: "/inscricoes", label: "Inscrições", icon: ClipboardList },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <HeartHandshake className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="font-semibold">Vida Plena</p>
        <p className="text-xs text-muted-foreground">Gestão de Eventos</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/" }}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          activeProps={{ className: "bg-accent !text-foreground" }}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function UserBox() {
  const { session, mainRole, signOut } = useAuth();
  return (
    <div className="border-t pt-4">
      <p className="truncate px-2 text-sm font-medium">{session?.user.email}</p>
      <p className="px-2 text-xs text-muted-foreground">
        {mainRole ? ROLE_LABEL[mainRole] : "Sem perfil"}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start"
        onClick={() => void signOut()}
      >
        <LogOut className="mr-2 h-4 w-4" /> Sair
      </Button>
    </div>
  );
}

function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">{children}</div>
    </div>
  );
}

/** Layout das páginas internas: exige login e perfil atribuído. */
export function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { loading, session, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <FullScreenMessage>
        <p className="text-muted-foreground">Carregando…</p>
      </FullScreenMessage>
    );
  }

  if (roles.length === 0) {
    return (
      <FullScreenMessage>
        <Brand />
        <p className="mt-6 font-medium">
          Seu acesso ainda não foi liberado. Fale com a coordenação.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Conta: {session.user.email}</p>
        <Button variant="outline" className="mt-6" onClick={() => void signOut()}>
          Sair
        </Button>
      </FullScreenMessage>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r bg-sidebar p-4 md:flex">
        <div className="space-y-6">
          <Brand />
          <NavLinks />
        </div>
        <UserBox />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-background px-4 py-3 md:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col justify-between p-4">
              <div className="space-y-6">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Brand />
                <NavLinks onNavigate={() => setOpen(false)} />
              </div>
              <UserBox />
            </SheetContent>
          </Sheet>
          <h1 className="flex-1 truncate text-lg font-semibold md:text-xl">{title}</h1>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
