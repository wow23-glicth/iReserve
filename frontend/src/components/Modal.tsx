import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Shared focus, dismissal, and scroll behavior for existing protected dialogs. */
export default function Modal({ children }: { children: ReactNode }) {
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(overlay.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length);
    const firstInput = overlay.current?.querySelector<HTMLElement>('input:not(:disabled)');
    (firstInput || focusable()[0])?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') overlay.current?.querySelector<HTMLButtonElement>('.modal-close:not(:disabled)')?.click();
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return createPortal(<div ref={overlay} className="modal-overlay" onMouseDown={event => {
    if (event.target === event.currentTarget) overlay.current?.querySelector<HTMLButtonElement>('.modal-close:not(:disabled)')?.click();
  }}>{children}</div>, document.body);
}
