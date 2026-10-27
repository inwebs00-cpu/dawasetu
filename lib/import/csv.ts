export interface CsvRecord {
  line: number;
  values: Record<string, string>;
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRecord[];
}

const MAX_CSV_COLUMNS = 32;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseCsv(text: string, maxRows = 500): ParsedCsv {
  if (text.length === 0) throw new Error("The CSV file is empty.");

  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const grid: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (
      closedQuote &&
      character !== "," &&
      character !== "\r" &&
      character !== "\n" &&
      !/\s/.test(character)
    ) {
      throw new Error("The CSV file has invalid text after a quoted value.");
    }
    if (character === '"') {
      if (field.length > 0 || closedQuote) {
        throw new Error("The CSV file has a quote in an invalid position.");
      }
      quoted = true;
      continue;
    }
    if (character === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
      if (row.length >= MAX_CSV_COLUMNS) {
        throw new Error(
          `CSV files can have at most ${MAX_CSV_COLUMNS} columns.`,
        );
      }
      continue;
    }
    if (character === "\r" || character === "\n") {
      row.push(field);
      if (row.some((value) => value.trim() !== "")) grid.push(row);
      row = [];
      field = "";
      closedQuote = false;
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      if (grid.length > maxRows + 1) {
        throw new Error(`Upload up to ${maxRows} medicine rows at a time.`);
      }
      continue;
    }
    if (!closedQuote) field += character;
  }

  if (quoted) throw new Error("The CSV file has an unclosed quoted value.");
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) grid.push(row);
  }

  if (grid.length < 2) {
    throw new Error("Add a header row and at least one medicine row.");
  }
  if (grid.length - 1 > maxRows) {
    throw new Error(`Upload up to ${maxRows} medicine rows at a time.`);
  }

  const headers = grid[0].map(normalizeHeader);
  if (headers.some((header) => !header)) {
    throw new Error("Every column must have a name in the first row.");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("The CSV contains duplicate column names.");
  }

  const rows = grid.slice(1).map((cells, index) => {
    if (
      cells.length > headers.length &&
      cells.slice(headers.length).some((value) => value.trim())
    ) {
      throw new Error(`Row ${index + 2} has more values than the header row.`);
    }
    return {
      line: index + 2,
      values: Object.fromEntries(
        headers.map((header, columnIndex) => [
          header,
          (cells[columnIndex] ?? "").trim(),
        ]),
      ),
    };
  });

  return { headers, rows };
}

export function parseCsvBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean | null {
  if (value === undefined || value.trim() === "") return defaultValue;
  switch (value.trim().toLowerCase()) {
    case "true":
    case "yes":
    case "1":
      return true;
    case "false":
    case "no":
    case "0":
      return false;
    default:
      return null;
  }
}
