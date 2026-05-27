import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CARRIER_SHIPPING_ADAPTER,
  CarrierShippingOption,
  ICarrierShippingAdapter,
} from '../../domain/ports/ICarrierShippingAdapter';

export interface QuoteCarrierShippingInput {
  /** Origin CEP (branch or tenant) */
  originCep: string;
  /** Destination CEP (customer) */
  destinationCep: string;
  /** Items with weight/dimensions for consolidated package calculation */
  items: Array<{
    weightGrams: number | null;
    heightCm: number | null;
    widthCm: number | null;
    lengthCm: number | null;
    quantity: number;
  }>;
}

export interface QuoteCarrierShippingOutput {
  options: CarrierShippingOption[];
}

/** Default package dimensions when item has no weight/dimensions configured */
const DEFAULT_ITEM_WEIGHT_GRAMS = 300;
const DEFAULT_ITEM_HEIGHT_CM = 5;
const DEFAULT_ITEM_WIDTH_CM = 15;
const DEFAULT_ITEM_LENGTH_CM = 20;

/** Minimum package dimensions required by carriers */
const MIN_HEIGHT_CM = 2;
const MIN_WIDTH_CM = 11;
const MIN_LENGTH_CM = 16;

@Injectable()
export class QuoteCarrierShippingUseCase {
  private readonly logger = new Logger(QuoteCarrierShippingUseCase.name);

  constructor(
    @Inject(CARRIER_SHIPPING_ADAPTER)
    private readonly carrierShippingAdapter: ICarrierShippingAdapter,
  ) {}

  async execute(
    input: QuoteCarrierShippingInput,
  ): Promise<QuoteCarrierShippingOutput> {
    const consolidated = this.consolidatePackage(input.items);

    this.logger.debug(
      `Quoting carrier shipping: ${input.originCep} → ${input.destinationCep}, ` +
        `package: ${consolidated.weightGrams}g, ` +
        `${consolidated.heightCm}x${consolidated.widthCm}x${consolidated.lengthCm}cm`,
    );

    const result = await this.carrierShippingAdapter.quoteShipping({
      originCep: input.originCep,
      destinationCep: input.destinationCep,
      weightGrams: consolidated.weightGrams,
      heightCm: consolidated.heightCm,
      widthCm: consolidated.widthCm,
      lengthCm: consolidated.lengthCm,
    });

    // Filter to only available options, sorted by price ascending
    const availableOptions = result.options
      .filter((opt) => opt.available)
      .sort((a, b) => a.price - b.price);

    return { options: availableOptions };
  }

  /**
   * Consolidates multiple items into a single package.
   * V1 strategy: sum weights, take max dimensions across all items.
   */
  private consolidatePackage(items: QuoteCarrierShippingInput['items']): {
    weightGrams: number;
    heightCm: number;
    widthCm: number;
    lengthCm: number;
  } {
    let totalWeight = 0;
    let maxHeight = 0;
    let maxWidth = 0;
    let maxLength = 0;

    for (const item of items) {
      const weight = item.weightGrams ?? DEFAULT_ITEM_WEIGHT_GRAMS;
      const height = item.heightCm ?? DEFAULT_ITEM_HEIGHT_CM;
      const width = item.widthCm ?? DEFAULT_ITEM_WIDTH_CM;
      const length = item.lengthCm ?? DEFAULT_ITEM_LENGTH_CM;

      totalWeight += weight * item.quantity;
      maxHeight = Math.max(maxHeight, height);
      maxWidth = Math.max(maxWidth, width);
      maxLength = Math.max(maxLength, length);
    }

    return {
      weightGrams: Math.max(totalWeight, 1),
      heightCm: Math.max(maxHeight, MIN_HEIGHT_CM),
      widthCm: Math.max(maxWidth, MIN_WIDTH_CM),
      lengthCm: Math.max(maxLength, MIN_LENGTH_CM),
    };
  }
}
