-- Private support inbox.
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.support_threads (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null default '',
  user_name text not null default 'Utilisateur',
  category text not null default 'help'
    check (category in ('problem', 'suggestion', 'advice', 'review', 'help')),
  subject text not null check (char_length(subject) between 1 and 140),
  status text not null default 'open'
    check (status in ('open', 'answered', 'pending', 'closed')),
  page_url text not null default '',
  context text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.support_messages (
  id text primary key default gen_random_uuid()::text,
  thread_id text not null references public.support_threads(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_email text not null default '',
  author_name text not null default 'Utilisateur',
  author_role text not null default 'user'
    check (author_role in ('user', 'admin')),
  body text not null check (char_length(body) between 1 and 2400),
  created_at timestamptz not null default now()
);

create index if not exists support_threads_user_updated_idx
  on public.support_threads(user_id, updated_at desc);

create index if not exists support_threads_status_updated_idx
  on public.support_threads(status, updated_at desc);

create index if not exists support_messages_thread_created_idx
  on public.support_messages(thread_id, created_at asc);

create or replace function public.touch_support_thread_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.support_threads
    set updated_at = now()
    where id = old.thread_id;
    return old;
  end if;

  update public.support_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists support_messages_touch_thread on public.support_messages;
create trigger support_messages_touch_thread
after insert or delete on public.support_messages
for each row execute function public.touch_support_thread_from_message();

create or replace function public.escape_builder_is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'isAdmin', '')) in ('1', 'true', 'yes')
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'is_admin', '')) in ('1', 'true', 'yes')
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'isAdmin', '')) in ('1', 'true', 'yes')
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'is_admin', '')) in ('1', 'true', 'yes')
    or exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb)) = 'array'
            then coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb)
          else '[]'::jsonb
        end
      ) role
      where lower(role) = 'admin'
    )
    or exists (
      select 1
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(coalesce(auth.jwt() -> 'user_metadata' -> 'roles', '[]'::jsonb)) = 'array'
            then coalesce(auth.jwt() -> 'user_metadata' -> 'roles', '[]'::jsonb)
          else '[]'::jsonb
        end
      ) role
      where lower(role) = 'admin'
    )
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'roles', '')) = 'admin'
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'roles', '')) = 'admin'
    or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) = 'admin';
$$;

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "Users can read their own support threads" on public.support_threads;
create policy "Users can read their own support threads"
on public.support_threads
for select
to authenticated
using (user_id = auth.uid() or public.escape_builder_is_admin());

drop policy if exists "Users can create their own support threads" on public.support_threads;
create policy "Users can create their own support threads"
on public.support_threads
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their own support threads" on public.support_threads;
create policy "Users can update their own support threads"
on public.support_threads
for update
to authenticated
using (user_id = auth.uid() or public.escape_builder_is_admin())
with check (user_id = auth.uid() or public.escape_builder_is_admin());

drop policy if exists "Users can read their own support messages" on public.support_messages;
create policy "Users can read their own support messages"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_threads threads
    where threads.id = thread_id
      and (threads.user_id = auth.uid() or public.escape_builder_is_admin())
  )
);

drop policy if exists "Users can add messages to their support threads" on public.support_messages;
create policy "Users can add messages to their support threads"
on public.support_messages
for insert
to authenticated
with check (
  (author_role = 'user' and author_id = auth.uid())
  or public.escape_builder_is_admin()
);
