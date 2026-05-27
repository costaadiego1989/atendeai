/**
 * Domain service responsible for resolving SKU identifiers.
 * Eliminates duplicated resolveSku logic across use cases.
 */
export class SkuResolver {
  /**
   * Resolves a SKU from available identifiers.
   * Priority: explicit SKU > external reference > normalized name.
   */
  static resolve(
    name: string,
    options?: {
      sku?: string;
      externalReference?: string;
    },
  ): string | undefined {
    const candidate =
      options?.sku?.trim() || options?.externalReference?.trim();
    if (candidate) {
      return candidate.toUpperCase();
    }

    const normalized = name
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase();

    return normalized || undefined;
  }
}
