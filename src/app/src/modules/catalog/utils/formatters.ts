export function formatCurrency(value?: number | string | null) {
  if (value == null) return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

export function formatSource(value?: string) {
  if (value === 'ERP_SNAPSHOT') return 'ERP';
  if (value === 'IMPORT') return 'Importado';
  return 'Manual';
}

export function formatType(value?: string) {
  if (value === 'PRODUCT') return 'Produto';
  if (value === 'RENTAL') return 'Locação';
  return 'Serviço';
}

export function requiresInventoryControl(type?: string) {
  return type === 'PRODUCT' || type === 'RENTAL';
}
