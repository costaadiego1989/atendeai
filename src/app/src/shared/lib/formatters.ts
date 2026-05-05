function toSafeDate(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }

  return new Date(value);
}

export function formatCurrency(
  value?: number | null,
  options?: Intl.NumberFormatOptions,
) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    ...options,
  }).format(value);
}

export function formatDate(
  value?: string | Date | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) {
    return null;
  }

  return toSafeDate(value).toLocaleDateString('pt-BR', options);
}

export function formatDateTime(
  value?: string | Date | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) {
    return null;
  }

  return toSafeDate(value).toLocaleString('pt-BR', options);
}

export function formatTime(
  value?: string | Date | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) {
    return null;
  }

  return toSafeDate(value).toLocaleTimeString('pt-BR', options);
}
