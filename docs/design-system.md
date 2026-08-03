# Design system — AgSUS Pesquisas

## Objetivo

Criar uma linguagem visual institucional consistente, acessível e reutilizável para todas as jornadas da plataforma.

## Princípios

1. **Clareza antes de ornamentação:** cada tela deve deixar evidente a próxima ação.
2. **Consistência:** mesmos estados, cores e componentes devem ter o mesmo significado.
3. **Hierarquia visual:** uma ação principal por contexto; ações secundárias não competem com ela.
4. **Acessibilidade:** contraste, foco visível, teclado, leitores de tela e redução de movimento.
5. **Responsividade real:** fluxos administrativos devem funcionar sem perda de informação em telas menores.
6. **Feedback imediato:** carregamento, sucesso, erro, vazio e operação offline devem ser comunicados.

## Tokens principais

- Primária: `#003B70`
- Primária forte: `#002B54`
- Secundária: `#0B8F58`
- Destaque: `#00A8D6`
- Fundo: `#F6F8FB`
- Texto principal: `#17233A`
- Texto secundário: `#5F6F86`
- Borda: `#E2E8F0`

Os tokens são definidos em `src/app/globals.css` e devem substituir cores repetidas sempre que um componente for revisado.

## Semântica de estado

- Azul: disponível, pendente ou ação informativa
- Âmbar: atenção, prazo próximo ou andamento
- Verde: sucesso, ativo ou concluído
- Vermelho: erro, bloqueio ou ação destrutiva
- Cinza: encerrado, excluído ou informação secundária

A cor nunca deve ser o único meio de comunicar um estado. Sempre usar rótulo, texto ou ícone complementar.

## Componentes-base

### Surface card

Usar `.surface-card` para superfícies principais. Evitar criar combinações diferentes de borda, raio e sombra em cada página.

### Metric card

Usar `.metric-card` para números resumidos. O valor deve ter maior destaque que o rótulo.

### Section eyebrow

Usar `.section-eyebrow` para indicar contexto da seção, sem substituir o título principal.

### Botões

- Primário: apenas para a ação mais importante do contexto.
- Secundário: borda neutra e fundo branco.
- Destrutivo: vermelho, com confirmação quando houver perda ou bloqueio.
- Desabilitado: deve explicar por que não pode ser acionado quando isso não for óbvio.

## Estados obrigatórios

Toda consulta assíncrona deve prever:

- carregando;
- sucesso com dados;
- sucesso sem dados;
- erro recuperável;
- ausência de permissão;
- indisponibilidade de conexão quando relevante.

## Formulários

- Rótulos visíveis, não apenas placeholders.
- Mensagem de validação junto ao campo.
- Preservar dados digitados após erro de servidor.
- Indicar campos obrigatórios.
- Evitar formulários longos em modal pequeno.
- Ações destrutivas separadas da ação de salvar.

## Tabelas e listas

- Busca e filtros acima do conteúdo.
- Contagem de resultados.
- Ordenação visível.
- Paginação ou virtualização para grandes volumes.
- Ações por linha com rótulos claros.
- Exportação deve respeitar os filtros ativos e as permissões do usuário.

## Acessibilidade

- Foco global visível.
- Alvo interativo mínimo recomendado de 44 x 44 px.
- Texto alternativo em imagens informativas.
- `aria-label` para botões somente com ícone.
- Respeito a `prefers-reduced-motion`.
- Cabeçalhos e landmarks semânticos.
- Não utilizar texto menor que 12 px para informação operacional essencial.

## Conteúdo e linguagem

- Verbos de ação: “Vincular participante”, “Publicar pesquisa”, “Continuar preenchimento”.
- Evitar termos técnicos de banco ou código na interface.
- Mensagens de erro devem dizer o que aconteceu e o que fazer.
- Confirmações devem citar o objeto afetado.

## Revisão de interface

Antes do merge, verificar:

- a próxima ação está evidente?
- há estados de vazio e erro?
- funciona por teclado?
- funciona em largura de 375 px?
- a operação crítica tem confirmação e auditoria?
- cores e componentes seguem os tokens?
- existe duplicação que deveria virar componente compartilhado?
