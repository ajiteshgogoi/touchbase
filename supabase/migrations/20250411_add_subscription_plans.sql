-- Create subscription plans table
create table if not exists public.subscription_plans (
    id text primary key,
    name text not null,
    price numeric not null,
    billing_period text not null check (billing_period in ('monthly', 'annual')),
    google_play_product_id text unique,
    monthly_equivalent numeric,
    contact_limit integer not null,
    features jsonb not null,
    created_at timestamp with time zone default now()
);

-- Add subscription plan policies
create policy "Anyone can read subscription plans"
    on public.subscription_plans for select
    to public
    using (true);

-- Enable RLS
alter table public.subscription_plans enable row level security;

-- Insert initial subscription plans
insert into public.subscription_plans (id, name, price, billing_period, google_play_product_id, monthly_equivalent, contact_limit, features)
values 
    ('free', 'Free', 0, 'monthly', null, 0, 15, '[
        "Up to 15 contacts",
        "Push notifications",
        "Smart reminder system",
        "1-tap interaction logging",
        "Conversation starters",
        "Intelligent rescheduling for missed interactions"
    ]'),
    ('premium', 'Premium', 3, 'monthly', 'touchbase_premium', 3, 2147483647, '[
        "Unlimited contacts",
        "Push notifications",
        "Smart reminder system",
        "1-tap interaction logging",
        "Conversation starters",
        "Intelligent rescheduling for missed interactions",
        "Contact interaction history",
        "Advanced AI suggestions",
        "Relationship insights",
        "Data export to CSV",
        "AI chat assistant",
        "Priority support"
    ]'),
    ('premium-annual', 'Premium', 27, 'annual', 'touchbase_premium_annual', 2.25, 2147483647, '[
        "Unlimited contacts",
        "Push notifications",
        "Smart reminder system",
        "1-tap interaction logging",
        "Conversation starters",
        "Intelligent rescheduling for missed interactions",
        "Contact interaction history",
        "Advanced AI suggestions",
        "Relationship insights",
        "Data export to CSV",
        "AI chat assistant",
        "Priority support"
    ]');

-- Add foreign key to subscriptions table
alter table if exists public.subscriptions
    add column if not exists subscription_plan_id text references public.subscription_plans(id);

-- Update existing subscriptions
update public.subscriptions
set subscription_plan_id = plan_id
where subscription_plan_id is null;

-- Create index for faster lookups
create index if not exists subscription_plans_google_play_idx on public.subscription_plans(google_play_product_id);