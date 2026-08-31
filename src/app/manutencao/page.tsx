import TelaDeManutencao from "@/components/tela-manutencao";

/**
 * Destino do rewrite da manutenção global.
 *
 * ## Por que uma rota, e por que rewrite
 *
 * Redirecionar produziria laço: o destino do redirect também está sob
 * manutenção e seria redirecionado de novo. Com rewrite, o endereço que a
 * pessoa digitou permanece na barra e o conteúdo servido é esta tela — quando
 * a manutenção sair, recarregar já entrega a página real, sem nada para
 * desfazer no histórico.
 *
 * A rota é pública e não lê banco, sessão nem marca: ela precisa renderizar
 * exatamente na situação em que o resto pode não estar disponível.
 *
 * O motivo registrado pela pessoa que ativou **não** aparece aqui. Ele é
 * operacional — "corrigir inconsistência na base", "implantar versão do
 * construtor" — e serve à auditoria, não a quem está do lado de fora.
 */
export default function PaginaDeManutencao() {
  return <TelaDeManutencao tipo="planejada" />;
}
