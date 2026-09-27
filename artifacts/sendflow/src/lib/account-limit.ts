export function formatAccountLimitAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(amount).replace(/\u202f/g, ' ');
}