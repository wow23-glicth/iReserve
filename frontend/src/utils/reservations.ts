export interface ReservationLineRecord {
  reservation_id: number;
  transaction_id: string | null;
  product_id: number;
  customer_id: number;
  customer_name: string;
  product_name: string;
  unit: string;
  price: number;
  quantity: number;
  reservation_date: string;
  created_at: string;
  status: string;
}

export interface ReservationTransaction {
  transaction_id: string;
  reservation_number: string;
  customer_id: number;
  customer_name: string;
  reservation_date: string;
  created_at: string;
  reservation_ids: number[];
  items: ReservationLineRecord[];
  total_quantity: number;
  total_amount: number;
  status: string;
  is_legacy: boolean;
}

export const formatReservationNumber = (
  transactionId: string,
  reservationDate: string,
  firstReservationId?: number
): string => {
  const datePart = (reservationDate || '').slice(0, 10).replace(/-/g, '') || 'UNDATED';
  const referencePart = transactionId.startsWith('legacy-')
    ? `L${firstReservationId ?? transactionId.replace('legacy-', '')}`
    : transactionId.replace(/-/g, '').slice(0, 12).toUpperCase();

  return `PJP-RES-${datePart}-${referencePart}`;
};

export const getAggregateStatus = (items: ReservationLineRecord[]): string => {
  if (!items.length) return 'Pending';
  const statuses = new Set(items.map(i => i.status));
  if (statuses.size === 1) return items[0].status;
  if (statuses.has('Pending')) return 'Pending';
  if (statuses.has('Approved')) return 'Approved';
  if (statuses.has('Claimed')) return 'Claimed';
  return 'Mixed';
};

export const groupReservationLines = (lines: ReservationLineRecord[]): ReservationTransaction[] => {
  const grouped = new Map<string, ReservationTransaction>();

  lines.forEach((line) => {
    const transactionId = line.transaction_id || `legacy-${line.reservation_id}`;
    const existing = grouped.get(transactionId);
    const lineAmount = (line.price || 0) * line.quantity;

    if (existing) {
      existing.items.push(line);
      existing.reservation_ids.push(line.reservation_id);
      existing.total_quantity += line.quantity;
      existing.total_amount += lineAmount;
      existing.status = getAggregateStatus(existing.items);

      if (new Date(line.created_at).getTime() < new Date(existing.created_at).getTime()) {
        existing.created_at = line.created_at;
      }
      return;
    }

    grouped.set(transactionId, {
      transaction_id: transactionId,
      reservation_number: formatReservationNumber(transactionId, line.reservation_date, line.reservation_id),
      customer_id: line.customer_id,
      customer_name: line.customer_name,
      reservation_date: line.reservation_date,
      created_at: line.created_at,
      reservation_ids: [line.reservation_id],
      items: [line],
      total_quantity: line.quantity,
      total_amount: lineAmount,
      status: line.status,
      is_legacy: !line.transaction_id
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const timestampDifference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timestampDifference !== 0) return timestampDifference;
    return Math.max(...b.reservation_ids) - Math.max(...a.reservation_ids);
  });
};
