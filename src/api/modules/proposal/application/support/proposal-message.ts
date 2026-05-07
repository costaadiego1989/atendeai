type ProposalMessageInput = {
  title: string;
  publicUrl: string;
};

export function buildProposalDeliveryMessage({
  title,
  publicUrl,
}: ProposalMessageInput): string {
  return [
    'Olá! Separei a sua proposta comercial.',
    '',
    `Proposta: ${title}`,
    'Abra o link abaixo para revisar os detalhes, confirmar o aceite e seguir para o pagamento quando estiver tudo certo:',
    publicUrl,
    '',
    'Se quiser ajustar algum ponto antes de aprovar, é só responder por aqui.',
  ].join('\n');
}
