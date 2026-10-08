export function getCurrencySymbol(code) {
  return code || 'TZS'
}

export function formatMoney(amount, currency) {
  const code = currency || 'TZS'
  return new Intl.NumberFormat('en-TZ', {
    maximumFractionDigits: 0,
  }).format(amount) + ' ' + code
}