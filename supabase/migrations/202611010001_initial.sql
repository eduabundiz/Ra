create extension if not exists pgcrypto;

create table public.admin_accounts(user_id uuid primary key references auth.users(id),email text not null,role text not null check(role in ('owner','editor')),active boolean not null default true);
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from admin_accounts where user_id=auth.uid() and active); $$;
create function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from admin_accounts where user_id=auth.uid() and active and role='owner'); $$;
create table public.matches(id uuid primary key,slug text not null unique,published boolean not null default false,data jsonb not null,version integer not null default 1);
create table public.seat_definitions(id text primary key,seat_group text not null,row_label text not null,seat_number integer not null,section text not null,zone text not null);
insert into public.seat_definitions values
('A-S15','A','S',15,'T1-04','Lateral Inferior Poniente'),('A-S16','A','S',16,'T1-04','Lateral Inferior Poniente'),('A-S17','A','S',17,'T1-04','Lateral Inferior Poniente'),('A-S18','A','S',18,'T1-04','Lateral Inferior Poniente'),('A-S19','A','S',19,'T1-04','Lateral Inferior Poniente'),
('B-R10','B','R',10,'T1-24','Lateral Inferior Oriente'),('B-R11','B','R',11,'T1-24','Lateral Inferior Oriente'),('B-R12','B','R',12,'T1-24','Lateral Inferior Oriente'),('B-Q13','B','Q',13,'T1-24','Lateral Inferior Oriente'),('B-Q14','B','Q',14,'T1-24','Lateral Inferior Oriente');
create table public.seat_inventory(match_id uuid references matches(id),seat_id text references seat_definitions(id),status text not null default 'available' check(status in ('available','reserved','sold')),version integer not null default 1,primary key(match_id,seat_id));
create function public.initialize_inventory() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into seat_inventory(match_id,seat_id) select new.id,id from seat_definitions;return new;end; $$;
create trigger new_match_inventory after insert on public.matches for each row execute function public.initialize_inventory();
create table public.reservations(id uuid primary key,match_id uuid not null references matches(id),data jsonb not null,version integer not null,created_at timestamptz not null default now());
create table public.inquiries(id uuid primary key,code text unique not null,match_id uuid not null references matches(id),data jsonb not null,created_at timestamptz not null default now());
create table public.site_settings(id integer primary key check(id=1),data jsonb not null);
insert into public.site_settings values(1,'{"phone":"523314581203","heroTitle":"El partido se vive juntos.","heroSubtitle":"Arma el plan. Invita a los tuyos. Vive al Guadalajara desde nuestros lugares en el Akron.","holdMinutes":30,"privacyName":"","privacyEmail":"","privacyAddress":""}');
create table public.media(id uuid primary key,published boolean not null default false,data jsonb not null);
create table public.audit_log(id uuid primary key default gen_random_uuid(),actor text not null,action text not null,details text not null,created_at timestamptz not null default now());
create table public.whatsapp_events(id text primary key,payload jsonb not null,created_at timestamptz not null default now());
create table public.whatsapp_outbox(id uuid primary key default gen_random_uuid(),event_key text not null unique,data jsonb not null,status text not null default 'pending' check(status in ('pending','processing','sent','review','simulated')),attempts integer not null default 0,leased_until timestamptz,meta_id text,error text,created_at timestamptz not null default now());
create table public.rate_limits(key text primary key,count integer not null,expires_at timestamptz not null);

create function public.compute_quote(m jsonb,seats text[],package text) returns integer language plpgsql stable set search_path=public as $$
declare expected text[];total integer;begin
 if cardinality(seats)=0 or cardinality(seats)<> (select count(distinct unnest) from unnest(seats)) or exists(select 1 from unnest(seats) s where not exists(select 1 from seat_definitions where id=s)) then raise exception 'Selección de asientos inválida.';end if;
 if package is not null then
 expected:=case package when 'A5' then array['A-S15','A-S16','A-S17','A-S18','A-S19'] when 'B5' then array['B-R10','B-R11','B-R12','B-Q13','B-Q14'] when 'B3' then array['B-R10','B-R11','B-R12'] when 'B2' then array['B-Q13','B-Q14'] else null end;
 if expected is null or not (seats @> expected and seats <@ expected) then raise exception 'El grupo no coincide con los asientos.';end if;
 total:=(m->'prices'->>package)::integer;
 else
 if not coalesce((m->>'allowIndividual')::boolean,false) then raise exception 'La venta individual está deshabilitada.';end if;
 select sum((m->'prices'->>case when d.seat_group='A' then 'individualA' else 'individualB' end)::integer) into total from seat_definitions d where id=any(seats);
 if exists(select 1 from seat_definitions d where id=any(seats) and (m->'prices'->>case when d.seat_group='A' then 'individualA' else 'individualB' end) is null) then raise exception 'Precio individual no disponible.';end if;
 end if;
 if total is null or total<=0 then raise exception 'Precio no disponible.';end if;return total;end;$$;

create function public.inventory_transition(p_action text,p_match_id uuid,p_seat_ids text[],p_package text,p_reservation_id uuid,p_expected_version integer,p_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare m jsonb;r jsonb;rid uuid;v integer;seats text[];st text;total integer;hold integer;msg text;begin
 if not is_admin() then raise exception 'FORBIDDEN';end if;
 select data into m from matches where id=p_match_id for update;if m is null then raise exception 'Partido no encontrado.';end if;
 if p_action='reserve' then
 if (m->>'kickoff')::timestamptz<=now() then raise exception 'El partido ya comenzó.';end if;
 total:=compute_quote(m,p_seat_ids,p_package);seats:=p_seat_ids;
 if (select count(*) from seat_inventory where match_id=p_match_id and seat_id=any(seats) and status='available')<>cardinality(seats) then raise exception 'Uno o más asientos ya no están disponibles.';end if;
 if coalesce(p_data->>'customerPhone','')<>'' and (p_data->>'customerPhone') !~ '^\d{10,15}$' then raise exception 'Teléfono inválido.';end if;
 select (data->>'holdMinutes')::integer into hold from site_settings where id=1;rid:=gen_random_uuid();v:=1;st:='reserved';
 r:=jsonb_build_object('id',rid,'matchId',p_match_id,'seatIds',to_jsonb(seats),'status',st,'customerName',coalesce(p_data->>'customerName',''),'customerPhone',coalesce(p_data->>'customerPhone',''),'total',total,'createdAt',now(),'reviewAt',now()+make_interval(mins=>coalesce(hold,30)),'paymentConfirmed',false,'deliveryStatus','pending','notes',coalesce(p_data->>'notes',''),'version',v,'lastInboundAt',p_data->>'lastInboundAt');
 insert into reservations(id,match_id,data,version) values(rid,p_match_id,r,v);
 else
 select data,version,id into r,v,rid from reservations where id=p_reservation_id and match_id=p_match_id for update;if r is null then raise exception 'Reserva no encontrada.';end if;
 if v<>p_expected_version then raise exception 'Otro administrador actualizó esta reserva.';end if;
 st:=r->>'status';if st='released' then raise exception 'La reserva ya fue liberada.';end if;
 select array_agg(value) into seats from jsonb_array_elements_text(r->'seatIds');
 if p_action='release' then if st='sold' then raise exception 'Una venta cerrada requiere revisión.';end if;st:='released';
 elsif p_action='sell' then if st='sold' then raise exception 'Venta ya confirmada.';end if;if not coalesce((r->>'paymentConfirmed')::boolean,false) or r->>'deliveryStatus'<>'completed' then raise exception 'Verifica el pago y completa la transferencia antes de cerrar la venta.';end if;st:='sold';
 elsif p_action='delivery' then
 if st='sold' and ((p_data ? 'paymentConfirmed' and not (p_data->>'paymentConfirmed')::boolean) or (p_data ? 'deliveryStatus' and p_data->>'deliveryStatus'<>'completed')) then raise exception 'Una venta cerrada no puede perder su verificación.';end if;
 if p_data ? 'deliveryStatus' then if p_data->>'deliveryStatus' not in ('pending','sent','completed') then raise exception 'Estado de entrega inválido.';end if;r:=r||jsonb_build_object('deliveryStatus',p_data->>'deliveryStatus');end if;
 if p_data ? 'paymentConfirmed' then r:=r||jsonb_build_object('paymentConfirmed',(p_data->>'paymentConfirmed')::boolean);end if;
 else raise exception 'Acción inválida.';end if;
 v:=v+1;r:=r||jsonb_build_object('status',st,'version',v);if p_data ? 'notes' then r:=r||jsonb_build_object('notes',p_data->>'notes');end if;update reservations set data=r,version=v where id=rid;
 end if;
 if p_action<>'delivery' then update seat_inventory set status=case st when 'released' then 'available' else st end,version=version+1 where match_id=p_match_id and seat_id=any(seats);end if;
 insert into audit_log(actor,action,details) values(auth.uid()::text,p_action,(m->>'opponent')||' · '||array_to_string(seats,', '));
 if coalesce(r->>'customerPhone','')<>'' and p_action<>'delivery' then
 msg:='Relampamigos · Guadalajara vs '||(m->>'opponent')||'. Estado de tu apartado: '||case st when 'reserved' then 'reservado; revisaremos el plazo contigo' when 'sold' then 'venta confirmada y transferencia completada' else 'liberado' end||'. Lugares: '||array_to_string(seats,', ')||'. Total MXN '||((r->>'total')::numeric/100)::text||', sin cargos adicionales.';
 insert into whatsapp_outbox(event_key,data) values(rid::text||':'||v::text,jsonb_build_object('phone',r->>'customerPhone','text',msg,'createdAt',now(),'lastInboundAt',r->>'lastInboundAt'));
 end if;return r;end;$$;

create function public.consume_rate_limit(p_key text,p_max integer) returns void language plpgsql security definer set search_path=public as $$ declare c integer;begin
 insert into rate_limits values(p_key,1,now()+interval '15 minutes') on conflict(key) do update set count=case when rate_limits.expires_at<now() then 1 else rate_limits.count+1 end,expires_at=case when rate_limits.expires_at<now() then now()+interval '15 minutes' else rate_limits.expires_at end returning count into c;
 if c>p_max then raise exception 'Demasiados intentos. Espera unos minutos.';end if;end;$$;
create function public.create_inquiry(p_id uuid,p_match_id uuid,p_seats text[],p_package text,p_rate_key text) returns jsonb language plpgsql security definer set search_path=public as $$ declare m jsonb;r jsonb;code text;total integer;begin
 perform consume_rate_limit(p_rate_key,30);
 select data into r from inquiries where id=p_id;if r is not null then if r->>'matchId'<>p_match_id::text or (r->'seatIds')<>to_jsonb(p_seats) then raise exception 'Referencia ya utilizada.';end if;return r;end if;
 select data into m from matches where id=p_match_id and published for share;if m is null or (m->>'kickoff')::timestamptz<=now() then raise exception 'Partido no disponible.';end if;total:=compute_quote(m,p_seats,p_package);
 if (select count(*) from seat_inventory where match_id=p_match_id and seat_id=any(p_seats) and status='available')<>cardinality(p_seats) then raise exception 'La disponibilidad cambió.';end if;
 code:='RL-'||upper(substr(replace(p_id::text,'-',''),1,12));r:=jsonb_build_object('id',p_id,'code',code,'matchId',p_match_id,'seatIds',to_jsonb(p_seats),'total',total,'createdAt',now(),'contacted',false,'packageId',p_package);insert into inquiries values(p_id,code,p_match_id,r,now());return r;end;$$;

create function public.process_whatsapp_message(p_id text,p_code text,p_phone text,p_timestamp timestamptz) returns void language plpgsql security definer set search_path=public as $$ declare i jsonb;m jsonb;begin
 insert into whatsapp_events(id,payload) values(p_id,jsonb_build_object('code',p_code,'phone',p_phone)) on conflict do nothing;if not found then return;end if;
 select data into i from inquiries where code=p_code for update;if i is null then return;end if;
 if coalesce(i->>'customerPhone','')<>'' and i->>'customerPhone'<>p_phone then return;end if;
 i:=i||jsonb_build_object('contacted',true,'customerPhone',p_phone,'lastInboundAt',p_timestamp);update inquiries set data=i where code=p_code;
 select data into m from matches where id=(i->>'matchId')::uuid;
 insert into whatsapp_outbox(event_key,data) values('inquiry:'||p_id,jsonb_build_object('phone',p_phone,'text','¡Hola! Recibimos tu consulta '||p_code||' para Guadalajara vs '||(m->>'opponent')||'. Un Relampamigo te confirmará disponibilidad y el apartado. Enviar esta consulta no reserva los lugares.','lastInboundAt',p_timestamp,'createdAt',now()));end;$$;
create function public.claim_whatsapp_outbox() returns setof whatsapp_outbox language sql security definer set search_path=public as $$ update whatsapp_outbox set status='processing',leased_until=now()+interval '2 minutes',attempts=attempts+1 where id in(select id from whatsapp_outbox where (status='pending' or (status='processing' and leased_until<now())) and attempts<3 order by created_at for update skip locked limit 5) returning *;$$;

alter table admin_accounts enable row level security;alter table matches enable row level security;alter table seat_definitions enable row level security;alter table seat_inventory enable row level security;alter table reservations enable row level security;alter table inquiries enable row level security;alter table site_settings enable row level security;alter table media enable row level security;alter table audit_log enable row level security;alter table whatsapp_events enable row level security;alter table whatsapp_outbox enable row level security;alter table rate_limits enable row level security;
create policy admin_self on admin_accounts for select to authenticated using(user_id=auth.uid() or is_owner());
create policy match_read on matches for select to anon,authenticated using(published or is_admin());
create policy seats_read on seat_definitions for select to anon,authenticated using(true);
create policy inventory_read on seat_inventory for select to anon,authenticated using(exists(select 1 from matches where id=match_id and (published or is_admin())));
create policy settings_read on site_settings for select to anon,authenticated using(true);
create policy media_read on media for select to anon,authenticated using(published or is_admin());
create policy reservations_admin on reservations for select to authenticated using(is_admin());
create policy inquiries_admin on inquiries for select to authenticated using(is_admin());
revoke all on admin_accounts,matches,seat_definitions,seat_inventory,reservations,inquiries,site_settings,media,audit_log,whatsapp_events,whatsapp_outbox,rate_limits from anon,authenticated;
grant select on matches,seat_definitions,seat_inventory,site_settings,media to anon,authenticated;
grant select on admin_accounts,reservations,inquiries to authenticated;
grant all on all tables in schema public to service_role;
revoke all on function inventory_transition(text,uuid,text[],text,uuid,integer,jsonb) from public,anon;
grant execute on function inventory_transition(text,uuid,text[],text,uuid,integer,jsonb) to authenticated;
revoke all on function create_inquiry(uuid,uuid,text[],text,text),consume_rate_limit(text,integer),process_whatsapp_message(text,text,text,timestamptz),claim_whatsapp_outbox() from public,anon,authenticated;
grant execute on function create_inquiry(uuid,uuid,text[],text,text),consume_rate_limit(text,integer),process_whatsapp_message(text,text,text,timestamptz),claim_whatsapp_outbox() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('site-media','site-media',false,8388608,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Storage remains private. Only the server publishes explicitly approved image rows.
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.seat_inventory;end if;end;$$;
