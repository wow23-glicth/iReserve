export interface RevenueRecord {
  total_amount: number | string; quantity: number | string; sale_date: string;
}
function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
/** Calendar-date keys keep years distinct and retain zero-sale days. */
export function revenueWeek(records: RevenueRecord[], today = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
    const key = dateKey(date);
    return { date: key, label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: records.filter(row => row.sale_date.slice(0, 10) === key).reduce((sum, row) => sum + Number(row.total_amount), 0) };
  });
}
