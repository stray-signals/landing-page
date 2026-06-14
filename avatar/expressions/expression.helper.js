const COLS = 64;

export const blankRow = '.'.repeat(COLS);

// Pad a single row to exactly 64 chars, centering the content.
// offset > 0 shifts right, offset < 0 shifts left.
// Uneven padding leans left (left side gets the extra dot).
export function normalizeRow(row, offset = 0) {
  if (row.length >= COLS) return row.slice(0, COLS);

  const totalPad = COLS - row.length;
  const leftPad  = Math.max(0, Math.ceil(totalPad / 2) + offset);
  const rightPad = Math.max(0, COLS - row.length - leftPad);

  return '.'.repeat(leftPad) + row + '.'.repeat(rightPad);
}

// Apply normalizeRow to every row in a data array.
export function normalizeRows(data, offset = 0) {
  return data.map(row => normalizeRow(row, offset));
}

// Reverse a row string so the face looks the other direction.
export function flipRow(row) {
  return row.split('').reverse().join('');
}

// Pad a row array to maxRows with blankRows.
//   'top'    - padding goes before the data  (eyes)
//   'bottom' - padding goes after the data   (mouths)
//   'split'  - split evenly, uneven leans bottom (faces)
// rowShift nudges the data vertically within the padded block (eyes only).
//   negative = shift up (less top padding), positive = shift down (more top padding)
export function padRowCount(data, maxRows, position = 'split', rowShift = 0) {
  const padding = Math.max(0, maxRows - data.length);

  if (position === 'top') {
    const topPad = Math.max(0, padding + rowShift);
    return [...Array(topPad).fill(blankRow), ...data].slice(0, maxRows);
  }
  if (position === 'bottom') {
    return [...data, ...Array(padding).fill(blankRow)];
  }
  // split
  const topPad    = Math.floor(padding / 2);
  const bottomPad = Math.ceil(padding / 2);
  return [
    ...Array(topPad).fill(blankRow),
    ...data,
    ...Array(bottomPad).fill(blankRow),
  ];
}
