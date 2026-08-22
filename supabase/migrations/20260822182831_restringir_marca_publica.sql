-- A marca completa inclui configuracoes operacionais de e-mail e presenca.
-- Esses campos nao precisam estar disponiveis para o papel anonimo via Data API.
-- A rota publica do Next.js passa a ler com service_role no servidor e devolver
-- somente uma lista explicita de campos visuais; usuarios autenticados preservam
-- o contrato completo usado pelas telas administrativas.

revoke all on function public.fc_obter_marca_plataforma() from public, anon;
grant execute on function public.fc_obter_marca_plataforma() to authenticated, service_role;
