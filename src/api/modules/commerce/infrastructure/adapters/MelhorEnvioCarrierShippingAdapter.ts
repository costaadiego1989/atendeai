import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CarrierShippingQuoteInput,
  CarrierShippingQuoteOutput,
  CarrierShippingOption,
  ICarrierShippingAdapter,
} from '../../domain/ports/ICarrierShippingAdapter';

interface MelhorEnvioQuoteResponse {
  id?: number;
  name?: string;
  price?: string;
  discount?: string;
  currency?: string;
  delivery_time?: number;
  delivery_range?: { min: number; max: number };
  company?: { id: number; name: string; picture?: string };
  error?: string;
}

/**
 * Adapter for Melhor Envio shipping quote API.
 * Docs: https://docs.melhorenvio.com.br
 *
 * Requires env vars:
 * - MELHOR_ENVIO_TOKEN: API bearer token
 * - MELHOR_ENVIO_SANDBOX: 'true' for sandbox, 'false' for production
 */
@Injectable()
export class MelhorEnvioCarrierShippingAdapter implements ICarrierShippingAdapter {
  private readonly logger = new Logger(MelhorEnvioCarrierShippingAdapter.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private readonly configService: ConfigService) {
    const isSandbox =
      this.configService.get<string>('MELHOR_ENVIO_SANDBOX', 'true') === 'true';
    this.baseUrl = isSandbox
      ? 'https://sandbox.melhorenvio.com.br'
      : 'https://api.melhorenvio.com.br';
    this.token = this.configService.get<string>('MELHOR_ENVIO_TOKEN', '');
  }

  async quoteShipping(
    input: CarrierShippingQuoteInput,
  ): Promise<CarrierShippingQuoteOutput> {
    const url = `${this.baseUrl}/api/v2/me/shipment/calculate`;

    const body = {
      from: { postal_code: this.sanitizeCep(input.originCep) },
      to: { postal_code: this.sanitizeCep(input.destinationCep) },
      package: {
        weight: input.weightGrams / 1000, // API expects kg
        width: input.widthCm,
        height: input.heightCm,
        length: input.lengthCm,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
          'User-Agent': 'AtendeAi/1.0',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Melhor Envio API error: ${response.status} - ${errorText}`,
        );
        return { options: [] };
      }

      const data: MelhorEnvioQuoteResponse[] = await response.json();
      const options = this.mapResponseToOptions(data);

      return { options };
    } catch (error) {
      this.logger.error(
        `Melhor Envio API request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { options: [] };
    }
  }

  private mapResponseToOptions(
    data: MelhorEnvioQuoteResponse[],
  ): CarrierShippingOption[] {
    return data.map((item) => {
      const hasError = !!item.error;
      const price = item.price ? parseFloat(item.price) : 0;
      const deliveryDays = item.delivery_time ?? item.delivery_range?.max ?? 0;

      return {
        serviceCode: String(item.id ?? ''),
        serviceName: item.name ?? 'Desconhecido',
        carrierName: item.company?.name ?? 'Desconhecido',
        price,
        deliveryDays,
        available: !hasError && price > 0,
        ...(hasError ? { errorMessage: item.error } : {}),
      };
    });
  }

  private sanitizeCep(cep: string): string {
    return cep.replace(/\D/g, '').padStart(8, '0');
  }
}
