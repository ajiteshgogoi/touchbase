-- Remove the plan_id check constraint
alter table subscriptions 
    drop constraint if exists subscriptions_plan_id_check;

-- Update any old plan_id values to map to new subscription_plan_id
update subscriptions
set subscription_plan_id = plan_id
where subscription_plan_id is null;

-- Drop the old plan_id column
alter table subscriptions
    drop column if exists plan_id;