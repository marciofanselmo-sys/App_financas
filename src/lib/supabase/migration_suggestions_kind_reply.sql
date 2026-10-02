-- ============================================================================
-- user_suggestions — tipo, tela e resposta da equipe (02/10/2026)
-- Rodar no SQL Editor do Supabase. Idempotente.
-- ============================================================================

-- Sem default no ADD: sugestões antigas ficam sem tipo (null), em vez de
-- todas virarem "Ideia". As novas nascem como 'ideia' pelo default abaixo.
alter table user_suggestions add column if not exists kind text;
alter table user_suggestions alter column kind set default 'ideia';
alter table user_suggestions add column if not exists screen text;
alter table user_suggestions add column if not exists admin_reply text;
alter table user_suggestions add column if not exists replied_at timestamptz;

alter table user_suggestions drop constraint if exists user_suggestions_kind_check;
alter table user_suggestions add constraint user_suggestions_kind_check
  check (kind is null or kind in ('ideia', 'problema', 'duvida', 'elogio'));

alter table user_suggestions drop constraint if exists user_suggestions_screen_check;
alter table user_suggestions add constraint user_suggestions_screen_check
  check (screen is null or char_length(screen) <= 60);

alter table user_suggestions drop constraint if exists user_suggestions_admin_reply_check;
alter table user_suggestions add constraint user_suggestions_admin_reply_check
  check (admin_reply is null or char_length(admin_reply) <= 2000);

-- Só o admin escreve a resposta: num insert do usuário, a resposta é sempre
-- descartada; quando a resposta muda, a data dela é atualizada.
create or replace function public.guard_user_suggestions_reply()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_app_admin() then
      new.admin_reply = null;
      new.replied_at = null;
    end if;
  elsif new.admin_reply is distinct from old.admin_reply then
    new.replied_at = case when new.admin_reply is null or trim(new.admin_reply) = '' then null else now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists user_suggestions_guard_reply on user_suggestions;
create trigger user_suggestions_guard_reply
  before insert or update on user_suggestions
  for each row execute function public.guard_user_suggestions_reply();
