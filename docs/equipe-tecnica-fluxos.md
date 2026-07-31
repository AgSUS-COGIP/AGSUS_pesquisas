# Equipe Técnica — fluxos funcionais

## Gestão da equipe

- A liderança abre **Minha equipe**.
- O sistema carrega o ciclo mais recente associado à pessoa.
- A liderança pode pesquisar participantes elegíveis por nome, matrícula ou e-mail.
- A inclusão cria um vínculo ativo de liderança e registra evento de auditoria.
- A retirada encerra o vínculo, preserva o histórico e registra evento de auditoria.
- Pessoas que já possuem liderança ativa no ciclo não aparecem como candidatas.

## Gestão de pesquisas

- A Equipe Técnica acessa **Pesquisas e ciclos**.
- A tela lista pesquisas, versões, ciclos, quantidade de seções e perguntas.
- Pesquisas em rascunho podem ser abertas no construtor.
- O construtor permite criar seções e perguntas.
- Tipos disponíveis na primeira versão: texto curto, texto longo, escolha única, múltipla escolha, escala e data.
- Perguntas em rascunho podem ser removidas.
- Alternativas são cadastradas junto da pergunta.

## Segurança e governança

- Operações administrativas exigem `can_manage_surveys()`.
- Gestão de equipe exige papel de liderança ou permissão administrativa.
- Todas as funções são executadas com validação de identidade autenticada.
- Inclusões e retiradas de equipe geram eventos em `audit_events`.
- Nenhuma alteração apaga o histórico de vínculos encerrados.
