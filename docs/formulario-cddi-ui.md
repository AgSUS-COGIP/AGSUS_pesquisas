# Experiência do formulário CDDI

A primeira interface funcional do CDDI 2026 utiliza a definição de formulário armazenada no PostgreSQL.

## Referências de experiência

- padrão de acesso, cabeçalho, navegação e linguagem visual do AgSUS Monitora;
- fluxo guiado do `Index` original do CDDI;
- questionário oficial com 12 competências, três comportamentos e um nível de desenvolvimento por competência;
- seção final para devolutiva, ações de desenvolvimento e demais registros textuais.

## Fluxo implementado

1. apresentação e orientações das escalas;
2. navegação por uma competência de cada vez;
3. validação das perguntas obrigatórias da etapa;
4. progresso global e conclusão por competência;
5. rascunho automático em `sessionStorage`;
6. revisão final com retorno direto às etapas incompletas.

## Segurança

A RPC `get_public_survey_form` retorna somente a estrutura pública do formulário. Nenhum participante, vínculo, resposta ou dado pessoal é exposto.

## Estado desta entrega

O formulário permite visualizar e preencher todas as perguntas cadastradas. O envio definitivo ainda permanece bloqueado até a implantação da autenticação institucional e da vinculação entre a sessão do usuário e a tabela `people`.
