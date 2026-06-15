export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string) {
  return digits(value).slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatCnpj(value: string) {
  return digits(value).slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatPhone(value: string) {
  const valueDigits = digits(value).slice(0, 11);
  if (valueDigits.length <= 10) return valueDigits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return valueDigits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatCep(value: string) {
  return digits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

export function parseCurrency(value: string) {
  const normalized = value.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized || 0);
}

export function formatCurrencyInput(value: string | number) {
  const numberValue = typeof value === "number" ? value : Number(digits(value)) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numberValue || 0);
}
