import chalk from "chalk";

export interface OutputOptions {
  json?: boolean;
  noColor?: boolean;
}

/**
 * Format and print output. If --json, prints JSON. Otherwise prints human-readable text.
 */
export function formatOutput(data: unknown, options: OutputOptions = {}): void {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (typeof data === "string") {
    console.log(data);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

/**
 * Print a table from an array of objects.
 */
export function printTable(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string; width?: number }[],
  options: OutputOptions = {},
): void {
  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log(chalk.dim("No results found."));
    return;
  }

  // Calculate column widths
  const widths = columns.map((col) => {
    const dataMax = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? "");
      return Math.max(max, val.length);
    }, 0);
    return col.width ?? Math.max(col.label.length, Math.min(dataMax, 50));
  });

  // Header
  const header = columns.map((col, i) => col.label.padEnd(widths[i]!)).join("  ");
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(header.length)));

  // Rows
  for (const row of rows) {
    const line = columns
      .map((col, i) => {
        const val = String(row[col.key] ?? "");
        return val.length > widths[i]! ? val.slice(0, widths[i]! - 1) + "…" : val.padEnd(widths[i]!);
      })
      .join("  ");
    console.log(line);
  }

  console.log(chalk.dim(`\n${rows.length} result${rows.length === 1 ? "" : "s"}`));
}

/**
 * Print key-value pairs.
 */
export function printKeyValue(
  data: Record<string, unknown>,
  options: OutputOptions = {},
): void {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const maxKeyLen = Math.max(...Object.keys(data).map((k) => k.length));
  for (const [key, value] of Object.entries(data)) {
    const label = chalk.bold(key.padEnd(maxKeyLen));
    const val = value === undefined || value === null ? chalk.dim("—") : String(value);
    console.log(`  ${label}  ${val}`);
  }
}

/**
 * Print a success message.
 */
export function success(message: string): void {
  console.log(chalk.green("✓") + " " + message);
}

/**
 * Print a warning message.
 */
export function warn(message: string): void {
  console.log(chalk.yellow("⚠") + " " + message);
}

/**
 * Print an info message.
 */
export function info(message: string): void {
  console.log(chalk.blue("ℹ") + " " + message);
}
