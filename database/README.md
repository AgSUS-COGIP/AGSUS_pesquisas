# Banco de dados

O schema de aplicação é `sigav`. As migrations versionadas estão em [migrations](migrations) e os testes SQL de invariantes em [tests](tests).

Use `scripts/aplicar-migrations.mjs` para registrar ou aplicar migrations no PostgreSQL configurado pelas variáveis de ambiente. Não edite uma migration que já tenha sido aplicada; crie uma nova com timestamp exclusivo.
