/**
 * CSV Report Utility
 * Builds and downloads the Sales and Reservations report exports.
 *
 * Downloads go through a Blob rather than a `data:` URI. `encodeURI` does not
 * escape '#', and in a URI everything from '#' onward is the fragment, so a
 * single '#' anywhere in the data (a product unit like "Bolt (#8)", a customer
 * name) silently truncated the file at that character — the remaining columns
 * and every following row were dropped without any error.
 *
 * Values are also escaped properly, so commas, quotes, and newlines inside a
 * name or a localised date no longer shift data into the wrong columns.
 */

export type CsvValue = string | number | null | undefined;

// Excel only reads a .csv as UTF-8 when it starts with a byte order mark;
// without it, accented characters in customer names come out mangled.
const BOM = '\uFEFF';

/**
 * Quote a field only when it needs it, doubling any embedded quotes as the
 * CSV convention requires.
 */
export function escapeCsvValue(value: CsvValue): string {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Join rows into a CSV body. CRLF is what Excel expects. */
export function buildCsv(rows: CsvValue[][]): string {
  return rows.map(row => row.map(escapeCsvValue).join(',')).join('\r\n');
}

/** Trigger a download of the given rows as a .csv file. */
export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const blob = new Blob([BOM + buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
