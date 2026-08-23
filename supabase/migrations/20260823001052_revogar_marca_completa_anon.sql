-- Segunda etapa do rollout expand/contract da marca institucional.
-- A aplicacao em producao ja usa fc_obter_marca_publica() antes do login.
revoke execute on function public.fc_obter_marca_plataforma() from anon;
notify pgrst, 'reload schema';
