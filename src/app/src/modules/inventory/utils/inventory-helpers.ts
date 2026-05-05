export function formatCurrency(value?: number) {
  if (value == null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatSource(value?: string) {
  if (value === 'ERP_SYNC') return 'ERP';
  if (value === 'PDV_SYNC') return 'PDV';
  if (value === 'ECOMMERCE_SYNC') return 'E-commerce';
  if (value === 'CSV_IMPORT' || value === 'IMPORT_SNAPSHOT') return 'CSV';
  if (value === 'BLING') return 'Bling';
  if (value === 'TINY') return 'Tiny';
  if (value === 'SHOPIFY') return 'Shopify';
  if (value === 'NUVEMSHOP') return 'Nuvemshop';
  if (value === 'WOOCOMMERCE') return 'WooCommerce';
  if (value === 'MERCADOLIVRE') return 'Mercado Livre';
  if (value === 'SHOPEE') return 'Shopee';
  return 'Manual';
}
