# Acesso institucional e autorização por pesquisa

A plataforma separa duas decisões de segurança:

1. **Autenticação institucional**: contas pertencentes aos domínios ativos em `TB_DOMINIO_INSTITUCIONAL` podem entrar na plataforma e recebem um cadastro institucional no primeiro acesso.
2. **Autorização por aplicação**: o acesso a cada ciclo depende de `TB_APLICACAO_PESQUISA.access_mode`.

## Modos de acesso

- `INSTITUTIONAL`: qualquer usuário institucional autenticado e ativo pode visualizar e responder durante o período aberto.
- `RESTRICTED`: somente participantes elegíveis em `RL_APLICACAO_PESSOA` e administradores podem acessar.

O ciclo `CDDI-2026` permanece com acesso `RESTRICTED`.

## Segurança

As RPCs `SECURITY DEFINER` não podem ser executadas pelo papel `anon`. O frontend deve chamar as funções somente após a criação da sessão autenticada.

`anon` aqui é claim de sessão, avaliada por `src/lib/db/rpc-permissions.ts` antes de a chamada chegar ao banco — não é role do Postgres. Desde `20260828140000_remover_roles_legadas_do_cluster.sql` a única role do cluster é `usr_sip_app`.

## Primeiro acesso

Quando `fc_obter_contexto_plataforma()` retorna `UNLINKED`, o frontend chama `resolve_authenticated_person(null)`. A função:

- valida o domínio institucional;
- vincula a conta a um cadastro existente por e-mail, quando houver;
- cria um cadastro institucional mínimo quando não houver registro prévio;
- registra a identidade institucional verificada.

## Variáveis de ambiente

O callback OAuth aceita os domínios definidos em:

```env
ALLOWED_INSTITUTIONAL_DOMAINS=agenciasus.org.br,agsus.org.br
```

Na ausência da variável, esses dois domínios são usados como padrão.
