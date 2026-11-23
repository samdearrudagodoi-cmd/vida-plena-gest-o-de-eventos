
CREATE TYPE public.app_role AS ENUM ('admin','coordenacao','voluntario');
CREATE TYPE public.event_type AS ENUM ('inclusao_digital','capacitacao_profissional','campanha_saude');
CREATE TYPE public.event_status AS ENUM ('planejado','inscricoes_abertas','realizado','cancelado');
CREATE TYPE public.attendance_status AS ENUM ('inscrito','presente','ausente','cancelado');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE public.beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  birth_date date NOT NULL,
  phone text NOT NULL,
  email text,
  region_id uuid NOT NULL REFERENCES public.regions(id),
  guardian_name text,
  guardian_phone text,
  consent_given boolean NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX beneficiaries_name_birth_uniq ON public.beneficiaries (lower(trim(full_name)), birth_date);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_type public.event_type NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  location text NOT NULL,
  region_id uuid NOT NULL REFERENCES public.regions(id),
  capacity integer NOT NULL CHECK (capacity > 0),
  status public.event_status NOT NULL DEFAULT 'planejado',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  attendance public.attendance_status NOT NULL DEFAULT 'inscrito',
  registered_by uuid REFERENCES auth.users(id),
  registered_at timestamptz DEFAULT now(),
  UNIQUE (beneficiary_id, event_id)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL CHECK (status IN ('enviado','falhou')),
  error_message text,
  sent_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regions, public.beneficiaries, public.events, public.registrations TO authenticated;
GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.regions, public.beneficiaries, public.events, public.registrations, public.notifications TO service_role;

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_beneficiaries_updated_at BEFORE UPDATE ON public.beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_beneficiary()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.consent_given IS NOT TRUE THEN
    RAISE EXCEPTION 'Consentimento obrigatório para cadastro';
  END IF;
  IF date_part('year', age(current_date, NEW.birth_date)) < 18 THEN
    IF coalesce(trim(NEW.guardian_name),'') = '' OR coalesce(trim(NEW.guardian_phone),'') = '' THEN
      RAISE EXCEPTION 'Menores de 18 anos exigem nome e telefone do responsável';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_beneficiary BEFORE INSERT OR UPDATE ON public.beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.validate_beneficiary();

CREATE OR REPLACE FUNCTION public.validate_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev record; used integer;
BEGIN
  SELECT status, capacity INTO ev FROM public.events WHERE id = NEW.event_id FOR UPDATE;
  IF ev.status IN ('cancelado','realizado') THEN
    RAISE EXCEPTION 'Evento não aceita inscrições';
  END IF;
  SELECT count(*) INTO used FROM public.registrations
   WHERE event_id = NEW.event_id AND attendance <> 'cancelado';
  IF used >= ev.capacity THEN
    RAISE EXCEPTION 'Evento sem vagas disponíveis';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_registration BEFORE INSERT ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.validate_registration();

-- Policies: user_roles
CREATE POLICY "Ler próprios perfis" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin insere perfis" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin altera perfis" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin remove perfis" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- regions
CREATE POLICY "Equipe lê regiões" ON public.regions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'voluntario') OR public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin insere regiões" ON public.regions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin altera regiões" ON public.regions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin remove regiões" ON public.regions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- beneficiaries
CREATE POLICY "Equipe lê beneficiários" ON public.beneficiaries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'voluntario') OR public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Equipe cadastra beneficiários" ON public.beneficiaries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'voluntario') OR public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Coordenação altera beneficiários" ON public.beneficiaries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin remove beneficiários" ON public.beneficiaries FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- events
CREATE POLICY "Equipe lê eventos" ON public.events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'voluntario') OR public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Coordenação cria eventos" ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Coordenação altera eventos" ON public.events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin remove eventos" ON public.events FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- registrations
CREATE POLICY "Equipe lê inscrições" ON public.registrations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'voluntario') OR public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Equipe cria inscrições" ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'voluntario') OR public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Equipe altera inscrições" ON public.registrations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'voluntario') OR public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'voluntario') OR public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin remove inscrições" ON public.registrations FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- notifications (insert only by service role, which bypasses RLS)
CREATE POLICY "Equipe lê notificações" ON public.notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'voluntario') OR public.has_role(auth.uid(),'coordenacao') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin remove notificações" ON public.notifications FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Views
CREATE VIEW public.v_beneficiaries WITH (security_invoker = true) AS
SELECT b.*,
  date_part('year', age(current_date, b.birth_date))::int AS age,
  r.name AS region_name,
  (SELECT count(*) FROM public.registrations x WHERE x.beneficiary_id = b.id)::int AS total_registrations,
  (SELECT count(*) FROM public.registrations x WHERE x.beneficiary_id = b.id AND x.attendance = 'presente')::int AS total_attended
FROM public.beneficiaries b JOIN public.regions r ON r.id = b.region_id;

CREATE VIEW public.v_event_summary WITH (security_invoker = true) AS
SELECT e.id, e.title, e.event_type, e.status, e.starts_at, e.location, e.region_id,
  r.name AS region_name, e.capacity,
  coalesce(s.registered,0)::int AS registered,
  coalesce(s.attended,0)::int AS attended,
  (e.capacity - coalesce(s.registered,0))::int AS remaining
FROM public.events e
JOIN public.regions r ON r.id = e.region_id
LEFT JOIN (
  SELECT event_id,
    count(*) FILTER (WHERE attendance <> 'cancelado') AS registered,
    count(*) FILTER (WHERE attendance = 'presente') AS attended
  FROM public.registrations GROUP BY event_id
) s ON s.event_id = e.id;

CREATE VIEW public.v_impact_by_region WITH (security_invoker = true) AS
SELECT r.id AS region_id, r.name AS region_name,
  count(DISTINCT x.beneficiary_id) FILTER (WHERE x.attendance = 'presente')::int AS beneficiaries_served,
  count(x.id) FILTER (WHERE x.attendance = 'presente')::int AS total_attended
FROM public.regions r
LEFT JOIN public.events e ON e.region_id = r.id
LEFT JOIN public.registrations x ON x.event_id = e.id
GROUP BY r.id, r.name;

GRANT SELECT ON public.v_beneficiaries, public.v_event_summary, public.v_impact_by_region TO authenticated;
GRANT SELECT ON public.v_beneficiaries, public.v_event_summary, public.v_impact_by_region TO service_role;
