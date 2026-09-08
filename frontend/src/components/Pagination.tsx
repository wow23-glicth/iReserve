import { ChevronLeft, ChevronRight } from 'lucide-react';
export default function Pagination({ page, pageCount, total, pageSize, onPage }: {
  page: number; pageCount: number; total: number; pageSize: number; onPage: (page: number) => void;
}) {
  if (!total) return null;
  return <nav className="pagination" aria-label="Table pagination">
    <p>Showing <strong>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</strong> of <strong>{total}</strong></p>
    <div><button className="icon-button" type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={17} /></button><span>Page {page} of {pageCount}</span><button className="icon-button" type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}><ChevronRight size={17} /></button></div>
  </nav>;
}
