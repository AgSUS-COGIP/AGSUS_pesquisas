# Acesso institucional e autorização por pesquisa

A plataforma separa duas decisões de segurança:

1. **Autenticação institucional**: contas pertencentes aos domínios ativos em `institutional_domains` podem entrar na plataforma e recebem um cadastro institucional no primeiro acesso.
2. **Autorização por aplicação**: o acesso a cada ciclo depende de `survey_applications.access_mode`.

## Modos de acesso

- `INSTITUTIONAL`: qualquer usuário institucional autenticado e ativo pode visualizar e responder durante o período aberto.
- `RESTRICTED`: somente participantes elegíveis em `application_participants` e administradores podem acessar.

O ciclo `CDDI-2026` permanece com acesso `RESTRICTED`.

## Segurança

As RPCs `SECURITY DEFINER` não podem ser executadas pelo papel `anon`. O frontend deve chamar as funções somente após a criação da sessão autenticada.

## Primeiro acesso

Quando `get_my_platform_context()` retorna `UNLINKED`, o frontend chama `resolve_authenticated_person(null)`. A função:

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
