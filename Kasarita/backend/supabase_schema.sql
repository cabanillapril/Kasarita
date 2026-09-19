create table if not exists public.tasks (
    id text primary key,
    title text not null,
    due_date text,
    priority text not null default 'normal',
    status text not null default 'pending',
    created_at timestamptz not null
);

create table if not exists public.reminders (
    id text primary key,
    title text not null,
    remind_at text,
    created_at timestamptz not null
);

alter table public.tasks enable row level security;
alter table public.reminders enable row level security;