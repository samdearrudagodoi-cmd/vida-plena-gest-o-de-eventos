import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/labels";

type AuthState = {
  loading: boolean;
  session: Session | null;
  roles: AppRole[];
  /** Maior perfil do usuário, para exibição. */
  mainRole: AppRole | null;
  isAdmin: boolean;
  canManageEvents: boolean;
  canEditBeneficiaries: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const ROLE_ORDER: AppRole[] = ["admin", "coordenacao", "voluntario"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadRoles(s: Session | null) {
      if (!s) {
        if (active) {
          setRoles([]);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id);
      if (active) {
        setRoles((data ?? []).map((r) => r.role));
        setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadRoles(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Recarregar perfis fora do callback evita travar o cliente de autenticação.
      setTimeout(() => void loadRoles(s), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const mainRole = ROLE_ORDER.find((r) => roles.includes(r)) ?? null;
  const isAdmin = roles.includes("admin");
  const isCoord = roles.includes("coordenacao");

  const value: AuthState = {
    loading,
    session,
    roles,
    mainRole,
    isAdmin,
    canManageEvents: isAdmin || isCoord,
    canEditBeneficiaries: isAdmin || isCoord,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
