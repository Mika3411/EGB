-- Help forum shared storage.
-- Run this in the Supabase SQL editor.

create table if not exists public.forum_posts (
  id text primary key,
  category text not null default 'help'
    check (category in ('help', 'tips', 'promotion')),
  author text not null default 'Createur',
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 1200),
  link text not null default '',
  read_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_replies (
  id text primary key,
  post_id text not null references public.forum_posts(id) on delete cascade,
  author text not null default 'Createur',
  owner_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forum_posts_updated_at_idx
  on public.forum_posts(updated_at desc);

create index if not exists forum_replies_post_id_created_at_idx
  on public.forum_replies(post_id, created_at asc);

create or replace function public.touch_forum_post_from_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.forum_posts
    set updated_at = now()
    where id = old.post_id;
    return old;
  end if;

  update public.forum_posts
  set updated_at = now()
  where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists forum_replies_touch_post on public.forum_replies;
create trigger forum_replies_touch_post
after insert or update or delete on public.forum_replies
for each row execute function public.touch_forum_post_from_reply();

alter table public.forum_posts enable row level security;
alter table public.forum_replies enable row level security;

drop policy if exists "Authenticated users can read forum posts" on public.forum_posts;
create policy "Authenticated users can read forum posts"
on public.forum_posts
for select
to authenticated
using (true);

drop policy if exists "Users can create their own forum posts" on public.forum_posts;
create policy "Users can create their own forum posts"
on public.forum_posts
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and read_only = false
);

drop policy if exists "Users can update their own forum posts" on public.forum_posts;
create policy "Users can update their own forum posts"
on public.forum_posts
for update
to authenticated
using (
  owner_id = auth.uid()
  and read_only = false
)
with check (
  owner_id = auth.uid()
  and read_only = false
);

drop policy if exists "Users can delete their own forum posts" on public.forum_posts;
create policy "Users can delete their own forum posts"
on public.forum_posts
for delete
to authenticated
using (
  owner_id = auth.uid()
  and read_only = false
);

drop policy if exists "Authenticated users can read forum replies" on public.forum_replies;
create policy "Authenticated users can read forum replies"
on public.forum_replies
for select
to authenticated
using (true);

drop policy if exists "Users can create their own forum replies" on public.forum_replies;
create policy "Users can create their own forum replies"
on public.forum_replies
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Users can update their own forum replies" on public.forum_replies;
create policy "Users can update their own forum replies"
on public.forum_replies
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Users can delete their own forum replies" on public.forum_replies;
create policy "Users can delete their own forum replies"
on public.forum_replies
for delete
to authenticated
using (owner_id = auth.uid());
