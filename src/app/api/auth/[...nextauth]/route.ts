import { handlers } from "@/lib/auth";

// Rota do Auth.js. O caminho de callback do Google passa a ser
// /api/auth/callback/google — é o que precisa ser cadastrado no Google Cloud
// Console, ao lado do antigo (.../auth/v1/callback do GoTrue), para que os dois
// fluxos possam coexistir durante a migração.
export const { GET, POST } = handlers;
