function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizeBrazilPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 13);

  if (!digits) {
    return '';
  }

  if (digits.startsWith('55')) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

export function formatCpf(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.replace(/(\d{3})(\d+)/, '$1.$2');
  if (digits.length <= 9) {
    return digits.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
}

export function formatCnpj(value: string): string {
  const digits = digitsOnly(value).slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return digits.replace(/(\d{2})(\d+)/, '$1.$2');
  if (digits.length <= 8) {
    return digits.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  }
  if (digits.length <= 12) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
  }

  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/,
    '$1.$2.$3/$4-$5',
  );
}

export function formatDocument(value: string): string {
  const digits = digitsOnly(value).slice(0, 14);

  if (digits.length <= 11) {
    return formatCpf(digits);
  }

  return formatCnpj(digits);
}

export function formatPhone(value: string): string {
  const allDigits = normalizeBrazilPhone(value);
  const hasCountryCode = allDigits.length > 11 && allDigits.startsWith('55');
  const digits = hasCountryCode ? allDigits.slice(2) : allDigits;

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) {
    const formatted = digits.replace(/(\d{2})(\d+)/, '($1) $2');
    return hasCountryCode ? `+55 ${formatted}` : formatted;
  }
  if (digits.length <= 10) {
    const formatted = digits.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
    return hasCountryCode ? `+55 ${formatted}` : formatted;
  }

  const formatted = digits.replace(/(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
  return hasCountryCode ? `+55 ${formatted}` : formatted;
}

export function formatCep(value: string): string {
  const digits = digitsOnly(value).slice(0, 8);

  if (digits.length <= 5) return digits;

  return digits.replace(/(\d{5})(\d+)/, '$1-$2');
}

export function formatCurrencyInput(value: string): string {
  const digits = digitsOnly(value);

  if (!digits) return '';

  const amount = Number(digits) / 100;
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyInput(value: string): string | undefined {
  const digits = digitsOnly(value);

  if (!digits) return undefined;

  return (Number(digits) / 100).toFixed(2);
}
