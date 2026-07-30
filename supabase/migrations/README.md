# Migrations do Supabase

As alterações estruturais do banco serão registradas neste diretório em arquivos SQL versionados.

## Regras

- Não criar tabelas manualmente em produção.
- Toda migration deve ser revisada antes da aplicação.
- Toda tabela exposta deve possuir Row Level Security e políticas explícitas.
- Não incluir senhas, tokens ou chaves neste diretório.
- A primeira migration será criada após a modelagem das três planilhas oficiais do CDDI.
