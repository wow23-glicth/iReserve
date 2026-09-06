import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { formatPeso, type SaleTransaction } from '../utils/sales';

interface SalesReceiptProps {
  sale: SaleTransaction;
  onClose: () => void;
}

const SalesReceipt = ({ sale, onClose }: SalesReceiptProps) => {
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

  const soldAt = new Date(sale.created_at);
  const formattedDate = Number.isNaN(soldAt.getTime())
    ? sale.sale_date
    : new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(soldAt);

  return createPortal(
    <div
      className="receipt-modal-overlay receipt-print-root"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="receipt-modal-shell" role="dialog" aria-modal="true" aria-labelledby="sales-receipt-title">
        <div className="receipt-screen-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            <X size={16} /> Close
          </button>
          <button ref={printButtonRef} type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print Receipt
          </button>
        </div>

        <article className="sales-receipt">
          <header className="receipt-header">
            <img src="/logo2.png" alt="PJP Hardware" className="receipt-logo" />
            <div>
              <h2 id="sales-receipt-title">PJP Hardware</h2>
              <p>Sales Receipt</p>
            </div>
          </header>

          <dl className="receipt-meta">
            <div>
              <dt>Receipt no.</dt>
              <dd>{sale.receipt_number}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formattedDate}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{sale.customer_name}</dd>
            </div>
          </dl>

          <table className="receipt-items">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => {
                const unitPrice = item.quantity > 0 ? item.total_amount / item.quantity : 0;
                return (
                  <tr key={item.sale_id}>
                    <td>
                      <strong>{item.product_name}</strong>
                      <span>{formatPeso(unitPrice)} / {item.unit}</span>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatPeso(item.total_amount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Total</th>
                <td>{formatPeso(sale.total_amount)}</td>
              </tr>
            </tfoot>
          </table>

          <footer className="receipt-footer">
            <p>{sale.total_quantity} item{sale.total_quantity === 1 ? '' : 's'} sold</p>
            <strong>Thank you for your purchase.</strong>
          </footer>
        </article>
      </div>
    </div>,
    document.body
  );
};

export default SalesReceipt;
