-- Presença global da plataforma em canal privado.
--
-- O estado é efêmero e fica no Realtime, não em tabela de negócio. As
-- políticas permitem apenas a pessoas autenticadas publicar a própria
-- presença e receber a lista sincronizada do tópico usado pela interface.

drop policy if exists "authenticated can read platform presence"
on realtime.messages;

create policy "authenticated can read platform presence"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) = 'platform-online'
  and realtime.messages.extension = 'presence'
);

drop policy if exists "authenticated can track platform presence"
on realtime.messages;

create policy "authenticated can track platform presence"
on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) = 'platform-online'
  and realtime.messages.extension = 'presence'
);
