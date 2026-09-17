import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { formatPeso } from '../utils/sales';
import type { ReservationTransaction } from '../utils/reservations';

interface ReservationSlipProps {
  reservation: ReservationTransaction;
  onClose: () => void;
}

const ReservationSlip = ({ reservation, onClose }: ReservationSlipProps) => {
  const printButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled)') || []
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    printButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const reservedAt = new Date(reservation.created_at);
  const formattedDate = Number.isNaN(reservedAt.getTime())
    ? reservation.reservation_date
    : new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(reservedAt);

  return createPortal(
    <div
      className="receipt-modal-overlay receipt-print-root"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="receipt-modal-shell" role="dialog" aria-modal="true" aria-labelledby="reservation-slip-title">
        <div className="receipt-screen-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            <X size={16} /> Close
          </button>
          <button ref={printButtonRef} type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print Slip
          </button>
        </div>

        <article className="sales-receipt">
          <header className="receipt-header">
            <img src="/logo2.png" alt="PJP Hardware" className="receipt-logo" />
            <div>
              <h2 id="reservation-slip-title">PJP Hardware</h2>
              <p>Reservation Confirmation Slip</p>
            </div>
          </header>

          <dl className="receipt-meta">
            <div>
              <dt>Reference no.</dt>
              <dd>{reservation.reservation_number}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formattedDate}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{reservation.customer_name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd><span className={`badge ${
                reservation.status === 'Approved'
                  ? 'badge-success'
                  : reservation.status === 'Pending'
                  ? 'badge-warning'
                  : reservation.status === 'Claimed'
                  ? 'badge-info'
                  : 'badge-danger'
              }`}>{reservation.status}</span></dd>
            </div>
          </dl>

          <table className="receipt-items">
            <thead>
              <tr>
                <th>Reserved Item</th>
                <th>Qty</th>
                <th>Est. Amount</th>
              </tr>
            </thead>
            <tbody>
              {reservation.items.map((item) => {
                const itemAmount = (item.price || 0) * item.quantity;
                return (
                  <tr key={item.reservation_id}>
                    <td>
                      <strong>{item.product_name}</strong>
                      <span>{formatPeso(item.price || 0)} / {item.unit}</span>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatPeso(itemAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Est. Total</th>
                <td>{formatPeso(reservation.total_amount)}</td>
              </tr>
            </tfoot>
          </table>

          <footer className="receipt-footer">
            <p>{reservation.total_quantity} item{reservation.total_quantity === 1 ? '' : 's'} reserved</p>
            <strong>Present this reference code upon pickup.</strong>
          </footer>
        </article>
      </div>
    </div>,
    document.body
  );
};

export default ReservationSlip;
