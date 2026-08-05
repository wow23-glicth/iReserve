/**
 * Excel Report Utility
 * Writes reports as a real .xlsx workbook.
 *
 * CSV is plain text and carries no formatting, so Excel opens it at the default
 * column width and shows '####' for any date or amount too wide to fit. Nothing
 * written into a CSV can prevent that — once Excel parses a value as a date it
 * redisplays it in its own locale format regardless of what we wrote. An .xlsx
 * stores explicit column widths, so the report is readable the moment it opens.
 */

import writeXlsxFile from 'write-excel-file/browser';
import type { SheetData } from 'write-excel-file/browser';

export type { SheetData } from 'write-excel-file/browser';

export type ExcelColumn = { width: number };

/**
 * Convert a 'YYYY-MM-DD' database date into a Date at UTC midnight.
 *
 * Excel stores a date as a day serial counted from UTC. Building the Date at
 * local midnight instead drags the serial backwards in any timezone ahead of
 * UTC — at UTC+8 a 2026-07-29 sale would otherwise export as 2026-07-28.
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Build the workbook and hand it to the browser as a download. */
export function downloadExcel(
  fileName: string,
  columns: ExcelColumn[],
  rows: SheetData
): Promise<void> {
  return writeXlsxFile(rows, { columns }).toFile(fileName);
}
