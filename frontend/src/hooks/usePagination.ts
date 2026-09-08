import { useEffect, useState } from 'react';
export function usePagination<T>(items: T[], resetKey = '', pageSize = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  useEffect(() => { setPage(1); }, [resetKey]);
  return { pageItems: items.slice((currentPage - 1) * pageSize, currentPage * pageSize), pagination: { page: currentPage, pageCount, total: items.length, pageSize, onPage: setPage } };
}
