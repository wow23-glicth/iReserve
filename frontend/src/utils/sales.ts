export interface SaleLineRecord {
  sale_id: number;
  transaction_id: string | null;
  product_id: number;
  customer_name: string;
  product_name: string;
  unit: string;
  quantity: number;
  sale_date: string;
  created_at: string;
  total_amount: number;
}

export interface SaleTransaction {
  transaction_id: string;
  receipt_number: string;
  customer_name: string;
  sale_date: string;
  created_at: string;
  sale_ids: number[];
  items: SaleLineRecord[];
  total_quantity: number;
  total_amount: number;
  is_legacy: boolean;
}

export const formatReceiptNumber = (
  transactionId: string,
  saleDate: string,
  firstSaleId?: number
) => {
  const datePart = saleDate.replace(/-/g, '') || 'UNDATED';
  const referencePart = transactionId.startsWith('legacy-')
    ? `L${firstSaleId ?? transactionId.replace('legacy-', '')}`
    : transactionId.replace(/-/g, '').slice(0, 16).toUpperCase();

  return `PJP-${datePart}-${referencePart}`;
};

export const groupSaleLines = (lines: SaleLineRecord[]): SaleTransaction[] => {
  const grouped = new Map<string, SaleTransaction>();

  lines.forEach((line) => {
    const transactionId = line.transaction_id || `legacy-${line.sale_id}`;
    const existing = grouped.get(transactionId);

    if (existing) {
      existing.items.push(line);
      existing.sale_ids.push(line.sale_id);
      existing.total_quantity += line.quantity;
      existing.total_amount += line.total_amount;

      if (new Date(line.created_at).getTime() < new Date(existing.created_at).getTime()) {
        existing.created_at = line.created_at;
      }
      return;
    }

    grouped.set(transactionId, {
      transaction_id: transactionId,
      receipt_number: formatReceiptNumber(transactionId, line.sale_date, line.sale_id),
      customer_name: line.customer_name,
      sale_date: line.sale_date,
      created_at: line.created_at,
      sale_ids: [line.sale_id],
      items: [line],
      total_quantity: line.quantity,
      total_amount: line.total_amount,
      is_legacy: !line.transaction_id
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const timestampDifference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timestampDifference !== 0) return timestampDifference;
    return Math.max(...b.sale_ids) - Math.max(...a.sale_ids);
  });
};

export const formatPeso = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
