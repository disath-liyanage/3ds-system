create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'manager', 'sales_rep', 'cashier');
create type public.order_status as enum ('pending', 'reviewing', 'approved', 'rejected', 'invoiced');
create type public.collection_status as enum ('pending', 'validated', 'rejected');
create type public.invoice_status as enum ('draft', 'issued', 'paid');

create sequence if not exists public.order_number_seq start with 1000 increment by 1;
create sequence if not exists public.collection_number_seq start with 3000 increment by 1;
create sequence if not exists public.invoice_number_seq start with 5000 increment by 1;
create sequence if not exists public.rn_number_seq start with 9000 increment by 1;

create table if not exists public.users_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role public.app_role not null default 'sales_rep',
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text not null,
  area text not null,
  credit_limit numeric(12, 2) not null default 0,
  balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text not null,
  price numeric(12, 2) not null check (price >= 0),
  stock_qty numeric(12, 2) not null default 0,
  low_stock_threshold numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique default nextval('public.order_number_seq'),
  customer_id uuid not null references public.customers (id),
  created_by uuid not null references public.users_profile (id),
  status public.order_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty numeric(12, 2) not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  collection_number bigint not null unique default nextval('public.collection_number_seq'),
  customer_id uuid not null references public.customers (id),
  collected_by uuid not null references public.users_profile (id),
  amount numeric(12, 2) not null check (amount > 0),
  validated_by uuid references public.users_profile (id),
  status public.collection_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number bigint not null unique default nextval('public.invoice_number_seq'),
  order_id uuid not null unique references public.orders (id),
  customer_id uuid not null references public.customers (id),
  issued_by uuid not null references public.users_profile (id),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status public.invoice_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty numeric(12, 2) not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.receive_notes (
  id uuid primary key default gen_random_uuid(),
  rn_number bigint not null unique default nextval('public.rn_number_seq'),
  supplier_name text not null,
  received_by uuid not null references public.users_profile (id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.receive_note_items (
  id uuid primary key default gen_random_uuid(),
  receive_note_id uuid not null references public.receive_notes (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty numeric(12, 2) not null check (qty > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null,
  performed_by uuid references public.users_profile (id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_customer_id on public.orders (customer_id);
create index if not exists idx_orders_created_by on public.orders (created_by);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_collections_customer_id on public.collections (customer_id);
create index if not exists idx_collections_collected_by on public.collections (collected_by);
create index if not exists idx_collections_status on public.collections (status);
create index if not exists idx_invoices_order_id on public.invoices (order_id);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items (invoice_id);
create index if not exists idx_receive_note_items_receive_note_id on public.receive_note_items (receive_note_id);
create index if not exists idx_audit_log_table_record on public.audit_log (table_name, record_id);

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users_profile
  where id = auth.uid();
$$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'manager'), false);
$$;

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_cashier_order_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_sanitized jsonb;
  new_sanitized jsonb;
begin
  if public.current_user_role() = 'cashier' then
    old_sanitized := to_jsonb(old) - '{status,updated_at}'::text[];
    new_sanitized := to_jsonb(new) - '{status,updated_at}'::text[];

    if old_sanitized <> new_sanitized then
      raise exception 'Cashier can only update order status';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.audit_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (table_name, record_id, action, performed_by, new_data)
  values (
    'orders',
    new.id,
    'insert',
    coalesce(auth.uid(), new.created_by),
    jsonb_build_object('status', new.status, 'order_number', new.order_number)
  );

  return new;
end;
$$;

create or replace function public.audit_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_log (table_name, record_id, action, performed_by, old_data, new_data)
    values (
      'orders',
      new.id,
      'status_update',
      auth.uid(),
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_set_updated_at on public.orders;
create trigger trg_orders_set_updated_at
before update on public.orders
for each row
execute function public.set_orders_updated_at();

drop trigger if exists trg_orders_cashier_status_only on public.orders;
create trigger trg_orders_cashier_status_only
before update on public.orders
for each row
execute function public.enforce_cashier_order_status_update();

drop trigger if exists trg_orders_audit_insert on public.orders;
create trigger trg_orders_audit_insert
after insert on public.orders
for each row
execute function public.audit_order_insert();

drop trigger if exists trg_orders_audit_update on public.orders;
create trigger trg_orders_audit_update
after update on public.orders
for each row
execute function public.audit_order_update();

alter table public.users_profile enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.collections enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.receive_notes enable row level security;
alter table public.receive_note_items enable row level security;
alter table public.audit_log enable row level security;

create policy users_profile_admin_manager_all on public.users_profile
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy customers_admin_manager_all on public.customers
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy products_admin_manager_all on public.products
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy orders_admin_manager_all on public.orders
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy order_items_admin_manager_all on public.order_items
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy collections_admin_manager_all on public.collections
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy invoices_admin_manager_all on public.invoices
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy invoice_items_admin_manager_all on public.invoice_items
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy receive_notes_admin_manager_all on public.receive_notes
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy receive_note_items_admin_manager_all on public.receive_note_items
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy audit_log_admin_manager_all on public.audit_log
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

create policy users_profile_self_select on public.users_profile
for select
using (id = auth.uid());

create policy users_profile_self_update on public.users_profile
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy customers_sales_rep_select on public.customers
for select
using (public.current_user_role() = 'sales_rep');

create policy products_sales_rep_select on public.products
for select
using (public.current_user_role() = 'sales_rep');

create policy orders_sales_rep_select_own on public.orders
for select
using (public.current_user_role() = 'sales_rep' and created_by = auth.uid());

create policy orders_sales_rep_insert on public.orders
for insert
with check (public.current_user_role() = 'sales_rep' and created_by = auth.uid());

create policy order_items_sales_rep_select_own on public.order_items
for select
using (
  public.current_user_role() = 'sales_rep'
  and exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.created_by = auth.uid()
  )
);

create policy order_items_sales_rep_insert on public.order_items
for insert
with check (
  public.current_user_role() = 'sales_rep'
  and exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.created_by = auth.uid()
  )
);

create policy collections_sales_rep_select_own on public.collections
for select
using (public.current_user_role() = 'sales_rep' and collected_by = auth.uid());

create policy collections_sales_rep_insert on public.collections
for insert
with check (public.current_user_role() = 'sales_rep' and collected_by = auth.uid());

create policy orders_cashier_select_all on public.orders
for select
using (public.current_user_role() = 'cashier');

create policy orders_cashier_update_status on public.orders
for update
using (public.current_user_role() = 'cashier')
with check (public.current_user_role() = 'cashier');

create policy collections_cashier_select_all on public.collections
for select
using (public.current_user_role() = 'cashier');

create policy collections_cashier_insert on public.collections
for insert
with check (public.current_user_role() = 'cashier');

create policy collections_cashier_update on public.collections
for update
using (public.current_user_role() = 'cashier')
with check (public.current_user_role() = 'cashier');

alter type public.app_role add value if not exists 'custom';

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  name varchar(50) not null unique,
  description text,
  created_by uuid references auth.users (id),
  created_at timestamptz default now(),
  perm_create_orders boolean default false,
  perm_approve_orders boolean default false,
  perm_view_all_orders boolean default false,
  perm_record_collections boolean default false,
  perm_validate_collections boolean default false,
  perm_manage_products boolean default false,
  perm_manage_customers boolean default false,
  perm_create_invoices boolean default false,
  perm_manage_receive_notes boolean default false,
  perm_view_reports boolean default false,
  perm_export_reports boolean default false,
  perm_manage_users boolean default false,
  perm_view_users boolean default false
);

alter table public.users_profile
  add column if not exists custom_role_id uuid references public.custom_roles (id),
  add column if not exists is_active boolean default true,
  add column if not exists created_by uuid references auth.users (id);

create index if not exists idx_users_profile_custom_role_id on public.users_profile (custom_role_id);

alter table public.custom_roles enable row level security;

drop policy if exists "admin_all_custom_roles" on public.custom_roles;
drop policy if exists "manager_view_custom_roles" on public.custom_roles;

create policy "admin_all_custom_roles" on public.custom_roles
  for all
  using (
    public.current_user_role() = 'admin'
  )
  with check (
    public.current_user_role() = 'admin'
  );

create policy "manager_view_custom_roles" on public.custom_roles
  for select
  using (
    public.current_user_role() in ('admin', 'manager')
  );

drop policy if exists "users_view_own_profile" on public.users_profile;
drop policy if exists users_profile_admin_manager_all on public.users_profile;
drop policy if exists users_profile_self_select on public.users_profile;
drop policy if exists users_profile_self_update on public.users_profile;
drop policy if exists "admin_all_profiles" on public.users_profile;
drop policy if exists "manager_view_profiles" on public.users_profile;
drop policy if exists "own_profile" on public.users_profile;

create policy "admin_all_profiles" on public.users_profile
  for all
  using (
    public.current_user_role() = 'admin'
  )
  with check (
    public.current_user_role() = 'admin'
  );

create policy "manager_view_profiles" on public.users_profile
  for select
  using (
    public.current_user_role() in ('admin', 'manager')
  );

create policy "own_profile" on public.users_profile
  for select
  using (auth.uid() = id);

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'customer_status'
      and n.nspname = 'public'
  ) then
    create type public.customer_status as enum ('pending_approval', 'active', 'rejected');
  end if;
end $$;

alter table public.customers
  add column if not exists status public.customer_status not null default 'active',
  add column if not exists created_by uuid references public.users_profile (id),
  add column if not exists approved_by uuid references public.users_profile (id),
  add column if not exists approved_at timestamptz;

create index if not exists idx_customers_status on public.customers (status);
create index if not exists idx_customers_created_by on public.customers (created_by);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users_profile (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'general',
  customer_id uuid references public.customers (id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz,
  created_by uuid references public.users_profile (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created on public.notifications (recipient_id, created_at desc);
create index if not exists idx_notifications_customer_id on public.notifications (customer_id);

alter table public.notifications enable row level security;

drop policy if exists notifications_recipient_select on public.notifications;
drop policy if exists notifications_recipient_update on public.notifications;
drop policy if exists notifications_admin_manager_all on public.notifications;

create policy notifications_recipient_select on public.notifications
for select
using (recipient_id = auth.uid());

create policy notifications_recipient_update on public.notifications
for update
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy notifications_admin_manager_all on public.notifications
for all
using (public.is_admin_or_manager())
with check (public.is_admin_or_manager());

drop policy if exists customers_sales_rep_select on public.customers;
drop policy if exists customers_all_authenticated_select on public.customers;
drop policy if exists customers_sales_rep_insert on public.customers;

create policy customers_all_authenticated_select on public.customers
for select
using (auth.uid() is not null);

create policy customers_sales_rep_insert on public.customers
for insert
with check (
  public.current_user_role() = 'sales_rep'
  and created_by = auth.uid()
  and status = 'pending_approval'
);

create or replace function public.enforce_sales_rep_pending_customer_invoice_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_row public.customers%rowtype;
  pending_invoice_count bigint;
begin
  if public.current_user_role() <> 'sales_rep' then
    return new;
  end if;

  if new.issued_by <> auth.uid() then
    raise exception 'Sales rep invoices must be issued by the current user';
  end if;

  select *
  into customer_row
  from public.customers
  where id = new.customer_id;

  if customer_row.id is null then
    raise exception 'Customer not found';
  end if;

  if customer_row.status = 'pending_approval' then
    select count(*)
    into pending_invoice_count
    from public.invoices i
    where i.customer_id = new.customer_id
      and i.issued_by = auth.uid();

    if pending_invoice_count >= 5 then
      raise exception 'Maximum 5 invoices allowed while customer approval is pending';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_sales_rep_limit on public.invoices;
create trigger trg_invoices_sales_rep_limit
before insert on public.invoices
for each row
execute function public.enforce_sales_rep_pending_customer_invoice_limit();

drop policy if exists invoices_sales_rep_select_own on public.invoices;
drop policy if exists invoices_sales_rep_insert on public.invoices;
drop policy if exists invoice_items_sales_rep_select_own on public.invoice_items;
drop policy if exists invoice_items_sales_rep_insert_own on public.invoice_items;

create policy invoices_sales_rep_select_own on public.invoices
for select
using (public.current_user_role() = 'sales_rep' and issued_by = auth.uid());

create policy invoices_sales_rep_insert on public.invoices
for insert
with check (public.current_user_role() = 'sales_rep' and issued_by = auth.uid());

create policy invoice_items_sales_rep_select_own on public.invoice_items
for select
using (
  public.current_user_role() = 'sales_rep'
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.issued_by = auth.uid()
  )
);

create policy invoice_items_sales_rep_insert_own on public.invoice_items
for insert
with check (
  public.current_user_role() = 'sales_rep'
  and exists (
    select 1
    from public.invoices i
    where i.id = invoice_items.invoice_id
      and i.issued_by = auth.uid()
  )
);
