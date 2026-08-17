// Shared CSV parser used by the Contacts page and the SMS dashboard import.
// Handles quoted commas (a comma inside "..." stays in one cell) and trims
// whitespace around every cell. Returns the raw cell grid; callers filter out
// blank rows and map columns themselves so the UI can let the user pick which
// column is phone vs. name.
export function parseCSV(text: string): string[][] {
  return text.split('\n').map((row) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of row) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}