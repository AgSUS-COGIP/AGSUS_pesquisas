# Migrations do PostgreSQL

As alterações estruturais do banco são registradas neste diretório em arquivos SQL versionados. O conjunto completo, em ordem de timestamp, é a fonte da verdade para reconstruir o esquema.

## Regras

- Não criar tabelas manualmente em produção.
- Toda migration deve ser revisada antes da aplicação.
- Toda tabela exposta deve possuir Row Level Security e políticas explícitas.
- Não incluir senhas, tokens ou chaves neste diretório.
- Não remover migrations já versionadas ou aplicadas; correções devem entrar em uma nova migration.
