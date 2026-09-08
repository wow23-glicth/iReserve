/** Preserve a blank field while typing; turn any entered negative number into zero. */
export function normalizeStockInput(value: string): string {
  return value !== '' && Number(value) < 0 ? '0' : value;
}

export function stockQuantity(value: unknown): number {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0;
}

export function availableStock(stock: unknown, reserved: unknown): number {
  // Invalid legacy data must never make an item sellable.
  if (!Number.isFinite(Number(stock)) || !Number.isFinite(Number(reserved)) || Number(stock) < 0 || Number(reserved) < 0) return 0;
  return Math.max(0, stockQuantity(stock) - stockQuantity(reserved));
}

export function stockNeedsReview(stock: unknown, reserved: unknown): boolean {
  return !Number.isFinite(Number(stock)) || !Number.isFinite(Number(reserved)) || Number(stock) < 0 || Number(reserved) < 0 || Number(reserved) > Number(stock);
}

export function parseStockInput(value: string): number {
  const quantity = Number(normalizeStockInput(value));
  if (value.trim() === '' || !Number.isInteger(quantity) || quantity > 2147483647) throw new Error('Enter a whole stock quantity between 0 and 2,147,483,647.');
  return quantity;
}
