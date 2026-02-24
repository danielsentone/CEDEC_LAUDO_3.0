-- Create table for Laudo Generation History
-- Fixed: protocol_id type changed to text to match protocols.id
create table if not exists laudo_history (
  id uuid default gen_random_uuid() primary key,
  protocol_id text references protocols(id) on delete cascade,
  engineer_id text,
  engineer_name text,
  created_at timestamp with time zone default now()
);

-- Add indexes for performance
create index if not exists idx_laudo_history_protocol_id on laudo_history(protocol_id);
