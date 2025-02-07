-- Add RLS policy for inserting subscriptions
create policy "Users can insert their own subscription"
    on public.subscriptions for insert
    with check (auth.uid() = user_id);

-- Add RLS policy for updating subscriptions
create policy "Users can update their own subscription"
    on public.subscriptions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);