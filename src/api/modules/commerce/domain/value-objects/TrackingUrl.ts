import { CommerceCarrier } from '../ports/ICommerceRepository';

const CARRIER_TRACKING_URLS: Record<string, (code: string) => string> = {
  CORREIOS: (code) =>
    `https://rastreio.correios.com.br/app/index.php?objetos=${code}`,
  JADLOG: (code) => `https://www.jadlog.com.br/tracking?code=${code}`,
  MELHOR_ENVIO: (code) =>
    `https://app.melhorenvio.com.br/shipment/tracking/${code}`,
};

/**
 * Generates a tracking URL based on the carrier and tracking code.
 * Returns null if carrier is OTHER or unknown.
 */
export function buildTrackingUrl(
  carrier: CommerceCarrier | null | undefined,
  trackingCode: string,
): string | null {
  if (!carrier || carrier === 'OTHER') {
    return null;
  }

  const builder = CARRIER_TRACKING_URLS[carrier];
  return builder ? builder(trackingCode) : null;
}

/**
 * Returns a human-readable carrier label for messages.
 */
export function getCarrierLabel(
  carrier: CommerceCarrier | null | undefined,
): string {
  switch (carrier) {
    case 'CORREIOS':
      return 'Correios';
    case 'JADLOG':
      return 'Jadlog';
    case 'MELHOR_ENVIO':
      return 'Melhor Envio';
    default:
      return 'Transportadora';
  }
}
