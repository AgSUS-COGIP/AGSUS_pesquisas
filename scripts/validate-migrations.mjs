import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MIGRATIONS_DIRECTORY = path.resolve(process.cwd(), "supabase/migrations");
const FILE_PATTERN = /^(?<version>\d{14})_(?<name>[a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

function fail(messages) {
  console.error("Falha na validação de migrations:\n");
  messages.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
}

async function main() {
  const entries = await readdir(MIGRATIONS_DIRECTORY, { withFileTypes: true });
  const migrationFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  const errors = [];
  const versions = new Map();

  for (const fileName of migrationFiles) {
    const match = FILE_PATTERN.exec(fileName);
    if (!match?.groups) {
      errors.push(
        `${fileName}: use o formato AAAAMMDDHHMMSS_nome_em_snake_case.sql.`,
      );
      continue;
    }

    const { version } = match.groups;
    const filesForVersion = versions.get(version) ?? [];
    filesForVersion.push(fileName);
    versions.set(version, filesForVersion);
  }

  for (const [version, files] of versions) {
    if (files.length > 1) {
      errors.push(
        `timestamp duplicado ${version}: ${files.join(", ")}. Cada migration deve ter identificador único.`,
      );
    }
  }

  if (!migrationFiles.length) {
    errors.push("nenhuma migration SQL foi encontrada em supabase/migrations.");
  }

  if (errors.length) {
    fail(errors);
    return;
  }

  console.log(
    `Migrations válidas: ${migrationFiles.length} arquivo(s), sem timestamps duplicados.`,
  );
}

main().catch((error) => {
  console.error("Não foi possível validar as migrations.", error);
  process.exitCode = 1;
});
