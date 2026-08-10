# Visão de produto e arquitetura — AgSUS Pesquisas

## 1. Posicionamento

A plataforma deve funcionar como o ambiente institucional único para pesquisas, avaliações, ciclos de desenvolvimento e coleta estruturada de dados da AgSUS.

Ela não é apenas um construtor de formulários. O produto é composto por cinco capacidades integradas:

1. identidade e acesso institucional;
2. gestão de pesquisas, versões e ciclos;
3. definição de público, papéis e hierarquias;
4. experiência segura de resposta;
5. resultados, devolutivas, auditoria e governança.

## 2. Princípios de produto

- **Uma identidade, várias jornadas:** a pessoa entra uma vez e visualiza apenas o que é relevante ao seu perfil.
- **Trabalho orientado a ações:** a página inicial prioriza pendências, prazos e continuidade de rascunhos.
- **Configuração sem perda de governança:** administradores ganham autonomia, mas alterações críticas são auditadas.
- **Segurança por padrão:** autorização por pesquisa, menor privilégio, RLS, funções protegidas e rastreabilidade.
- **Acessibilidade e responsividade:** teclado, leitores de tela, contraste, redução de movimento e operação móvel.
- **Evolução modular:** novas modalidades de pesquisa não devem exigir duplicação de páginas ou regras.

## 3. Arquitetura funcional

```text
Identidade institucional
  └── Pessoas e vínculos
      ├── Papéis globais
      ├── Hierarquias organizacionais
      └── Participações por pesquisa

Catálogo de pesquisas
  └── Instrumentos versionados
      └── Aplicações/ciclos
          ├── Público e elegibilidade
          ├── Convites e comunicação
          ├── Submissões e rascunhos
          └── Resultados e devolutivas
```

## 4. Estratégia de formulários

A plataforma adotará arquitetura híbrida:

### Motor nativo

Usado para jornadas institucionais fortemente integradas, como CDDI, avaliações de liderança e instrumentos com regras específicas de devolutiva.

Vantagens:

- integração total com permissões e hierarquias;
- experiência visual consistente;
- cálculo e devolutiva em tempo real;
- controle fino de estados e regras de negócio.

### ODK Web Forms / Enketo

Usado para instrumentos extensos, coleta de campo, operação offline, anexos, GPS, repetições, múltiplos idiomas e lógica XLSForm complexa.

A plataforma AgSUS continuará responsável por autenticação, autorização, participantes, ciclo e auditoria. O motor externo será apenas a camada de preenchimento e coleta.

## 5. Arquitetura técnica-alvo

```text
Next.js / Vercel
  ├── interface web responsiva
  ├── rotas protegidas e componentes do design system
  ├── server actions/route handlers para operações sensíveis
  └── monitoramento de experiência

Supabase
  ├── PostgreSQL
  ├── Auth Google institucional
  ├── RLS e funções de domínio
  ├── Storage
  ├── auditoria
  └── jobs e integrações

Integrações opcionais
  ├── ODK Central / Web Forms / Enketo
  ├── e-mail institucional
  ├── Power BI
  └── bases corporativas da UGP
```

## 6. Domínios do sistema

- Identidade e pessoas
- Pesquisas e versões
- Ciclos e calendários
- Participantes e elegibilidade
- Submissões e respostas
- Equipes e hierarquias
- Resultados e devolutivas
- Comunicação e notificações
- Auditoria e conformidade
- Integrações e importações

Cada domínio deve expor operações explícitas e auditáveis, evitando acesso direto indiscriminado às tabelas pelo frontend.

## 7. Roadmap recomendado

### Fundação

- página inicial dinâmica;
- design system e componentes compartilhados;
- gestão de participantes por pesquisa;
- consistência de identidade e fotos de perfil do Google;
- tratamento de erro, vazio, carregamento e offline.

### Operação institucional

- importação em massa com pré-validação;
- grupos e regras de elegibilidade;
- convites e lembretes;
- calendário e encerramento automatizado;
- trilha de auditoria navegável.

### Inteligência

- painéis configuráveis por perfil;
- indicadores de participação e qualidade;
- comparações históricas;
- anonimização e limites mínimos de grupo;
- exportação governada.

### Plataforma avançada

- integração ODK/Enketo;
- biblioteca de modelos de pesquisa;
- fluxo de aprovação e publicação;
- API institucional;
- observabilidade, SLOs e recuperação de desastres.

## 8. Critérios de qualidade

Uma funcionalidade só deve ser considerada pronta quando tiver:

- autorização no servidor;
- validação de entrada;
- auditoria das mudanças críticas;
- estados de carregamento, vazio e erro;
- comportamento responsivo;
- acessibilidade básica;
- testes automatizados;
- build, lint e TypeScript aprovados;
- documentação da regra de negócio.
