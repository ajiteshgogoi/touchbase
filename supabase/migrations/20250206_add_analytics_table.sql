create table public.contact_analytics (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  generated_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null
);

-- Create index for faster user_id lookups
create index contact_analytics_user_id_idx on public.contact_analytics (user_id);

-- RLS policies
alter table public.contact_analytics enable row level security;

create policy "Users can view only their own analytics"
  on public.contact_analytics for select
  using (auth.uid() = user_id);

create policy "Users can insert only their own analytics"
  on public.contact_analytics for insert
  with check (auth.uid() = user_id);

create policy "Users can update only their own analytics"
  on public.contact_analytics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete only their own analytics"
  on public.contact_analytics for delete
  using (auth.uid() = user_id);