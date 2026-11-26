// Dictionaries may hold plain strings or structured entries (arrays and objects) for rich text.
// These helpers flatten any shape to string leaves so tests do not depend on the entry format.
export type Leaf = [path: string, value: string];

export function flatEntries(value: unknown, path = ""): Leaf[] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => flatEntries(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flatEntries(v, path ? `${path}.${k}` : k),
    );
  }
  return [];
}

export const leafValues = (d: unknown): string[] => flatEntries(d).map(([, v]) => v);
export const leafPaths = (d: unknown): string[] => flatEntries(d).map(([p]) => p).sort();

// Top-level keys plus the shape of structured entries (so en and zh must match in structure).
export function shape(value: unknown): unknown {
  if (typeof value === "string") return "s";
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, shape(v)]),
    );
  return typeof value;
}
