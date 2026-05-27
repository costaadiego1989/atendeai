/**
 * Port for carrier shipping quote integration (e.g., Melhor Envio).
 * Provides freight quotes based on origin/destination CEP and package dimensions.
 */

export interface CarrierShippingQuoteInput {
  /** Origin CEP (from branch or tenant) */
  originCep: string;
  /** Destination CEP (from customer) */
  destinationCep: string;
  /** Package weight in grams */
  weightGrams: number;
  /** Package height in cm */
  heightCm: number;
  /** Package width in cm */
  widthCm: number;
  /** Package length in cm */
  lengthCm: number;
}

export interface CarrierShippingOption {
  /** Carrier service code (e.g., '1' for PAC, '2' for SEDEX in Melhor Envio) */
  serviceCode: string;
  /** Human-readable service name (e.g., 'PAC', 'SEDEX', 'Jadlog .Package') */
  serviceName: string;
  /** Carrier company name (e.g., 'Correios', 'Jadlog') */
  carrierName: string;
  /** Freight price in BRL */
  price: number;
  /** Estimated delivery time in business days */
  deliveryDays: number;
  /** Whether this option has any error/restriction */
  available: boolean;
  /** Error message if not available */
  errorMessage?: string;
}

export interface CarrierShippingQuoteOutput {
  options: CarrierShippingOption[];
}

export interface ICarrierShippingAdapter {
  /**
   * Fetches available shipping options for the given package and route.
   * Returns all options (available and unavailable) so the UI can show restrictions.
   */
  quoteShipping(
    input: CarrierShippingQuoteInput,
  ): Promise<CarrierShippingQuoteOutput>;
}

export const CARRIER_SHIPPING_ADAPTER = Symbol('CARRIER_SHIPPING_ADAPTER');
