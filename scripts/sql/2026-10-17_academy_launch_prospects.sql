-- Academy launch offer: public sign-up from the academy pages, and full
-- edit/delete of prospects in the admin Prospect Database.
-- Applied to the Supabase project in four steps (see the comments below).

-- 1. New lead type (run on its own: a new enum value cannot be used in the
--    same transaction that adds it).
alter type lead_type add value if not exists 'ACADEMY_LAUNCH';

-- 2. Public: academy launch-offer sign-up from the static academy pages.
create or replace function public.register_academy_interest(
  p_full_name text, p_email text, p_academy text,
  p_company_name text default null, p_phone text default null,
  p_country text default null, p_message text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_lead uuid; v_acad text := nullif(btrim(coalesce(p_academy,'')),'');
begin
  if not educut_valid_email(p_email) then raise exception 'INVALID_EMAIL' using errcode='22023'; end if;
  if nullif(btrim(coalesce(p_full_name,'')),'') is null then raise exception 'NAME_REQUIRED' using errcode='22023'; end if;
  if length(p_full_name) > 200 or length(coalesce(p_company_name,'')) > 200 or length(coalesce(p_phone,'')) > 50
     or length(coalesce(p_country,'')) > 100 or length(coalesce(v_acad,'')) > 120 or length(coalesce(p_message,'')) > 2000 then
    raise exception 'TOO_LONG' using errcode='22023';
  end if;
  v_lead := educut_upsert_lead(p_email, p_full_name, p_company_name, p_phone, p_country, 'ACADEMY_LAUNCH');
  update leads set
    interested_academies = case
      when v_acad is null or v_acad = any(interested_academies) or coalesce(array_length(interested_academies,1),0) >= 18
        then interested_academies else interested_academies || v_acad end,
    message = coalesce(nullif(btrim(coalesce(p_message,'')),''), message),
    updated_at = now()
  where id = v_lead;
  perform educut_notify_staff('Academy launch sign-up',
    btrim(p_full_name) || ' registered for the launch offer' || coalesce(' (' || v_acad || ')', '') || '.', v_lead::text);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.register_academy_interest(text,text,text,text,text,text,text) from public;
grant execute on function public.register_academy_interest(text,text,text,text,text,text,text) to anon, authenticated;

-- 3. Staff: edit and delete a prospect.
create or replace function public.admin_update_prospect(
  p_id uuid, p_full_name text, p_email text, p_company_name text, p_phone text,
  p_country text, p_message text, p_status text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_platform_staff() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
  if not educut_valid_email(p_email) then raise exception 'INVALID_EMAIL' using errcode='22023'; end if;
  if p_status not in ('NEW','CONTACTED','QUALIFIED','CONVERTED','CLOSED') then raise exception 'INVALID_STATUS' using errcode='22023'; end if;
  if exists (select 1 from leads where email = educut_norm_email(p_email) and id <> p_id) then
    raise exception 'EMAIL_IN_USE' using errcode='23505';
  end if;
  update leads set
    full_name = nullif(btrim(coalesce(p_full_name,'')),''),
    email = educut_norm_email(p_email),
    company_name = nullif(btrim(coalesce(p_company_name,'')),''),
    phone = nullif(btrim(coalesce(p_phone,'')),''),
    country = nullif(btrim(coalesce(p_country,'')),''),
    message = nullif(btrim(coalesce(p_message,'')),''),
    status = p_status::lead_status,
    updated_at = now()
  where id = p_id;
  if not found then raise exception 'NOT_FOUND' using errcode='22023'; end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_update_prospect(uuid,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.admin_update_prospect(uuid,text,text,text,text,text,text,text) to authenticated;

-- Deleting a lead cascades to its consultations and catalogue requests;
-- assessment submissions are kept and unlinked (existing foreign keys).
create or replace function public.admin_delete_prospect(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_platform_staff() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
  delete from leads where id = p_id;
  if not found then raise exception 'NOT_FOUND' using errcode='22023'; end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_delete_prospect(uuid) from public, anon;
grant execute on function public.admin_delete_prospect(uuid) to authenticated;

-- 4. Expose the academies a prospect signed up for in the admin list.
create or replace function public.admin_prospects()
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare v jsonb;
begin
  if not is_platform_staff() then raise exception 'NOT_AUTHORISED' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'fullName', l.full_name, 'email', l.email, 'company', l.company_name,
    'phone', l.phone, 'country', l.country, 'type', l.type, 'status', l.status,
    'firstSource', l.first_source, 'latestSource', l.latest_source,
    'createdAt', l.created_at, 'updatedAt', l.updated_at, 'message', l.message,
    'academies', to_jsonb(l.interested_academies),
    'launchOffer', (l.first_source = 'ACADEMY_LAUNCH' or l.latest_source = 'ACADEMY_LAUNCH'),
    'catalogue', jsonb_build_object('requested', l.catalogue_requested, 'count', coalesce(cat.n, 0),
                   'downloads', coalesce(cat.downloads, 0), 'status', cat.last_status),
    'consultation', jsonb_build_object('requested', l.consultation_requested, 'live', coalesce(con.n, 0),
                   'deleted', l.consultations_deleted, 'ref', l.last_consultation_ref,
                   'status', l.last_consultation_status, 'date', l.last_consultation_date,
                   'wasDeleted', l.last_consultation_deleted),
    'assessment', jsonb_build_object('completed', l.assessment_completed, 'count', coalesce(asm.n, 0))
  ) order by l.updated_at desc), '[]'::jsonb) into v
  from leads l
  left join lateral (select count(*) as n, sum(r.download_count) as downloads,
           (array_agg(r.status::text order by r.requested_at desc))[1] as last_status
           from catalogue_requests r where r.lead_id = l.id) cat on true
  left join lateral (select count(*) as n from consultations c where c.lead_id = l.id) con on true
  left join lateral (select count(*) as n from assessment_submissions a where a.lead_id = l.id) asm on true;
  return v;
end $function$;
