/**
 * Greedy page breaking over measured units.
 *
 * `keep[i]` means unit i must stay on the same page as unit i + 1 (headings, entry lines, the second-to-last
 * bullet). A run of such units is one block that is moved to the next page as a whole. The first unit of a page
 * loses its top padding, so `pad[i]` is subtracted when a unit starts a page.
 * Returns the index of the first unit of every page (always starts with 0).
 */
export function paginate(h: readonly number[], pad: readonly number[], keep: readonly boolean[], cap1: number, capN: number): number[] {
  const n = h.length;
  const starts = [0];
  let cap = cap1;
  let used = 0;
  let empty = true;

  const startPage = (at: number) => {
    starts.push(at);
    cap = capN;
    used = 0;
    empty = true;
  };
  const need = (k: number) => (h[k] ?? 0) - (empty ? (pad[k] ?? 0) : 0);

  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && keep[j] === true) j++;
    let block = 0;
    for (let k = i; k <= j; k++) block += h[k] ?? 0;
    if (!empty && used + block > cap) startPage(i);
    if (block - (empty ? (pad[i] ?? 0) : 0) <= cap) {
      used += block - (empty ? (pad[i] ?? 0) : 0);
      empty = false;
    } else {
      // a block taller than a page: place its units one by one
      for (let k = i; k <= j; k++) {
        if (!empty && used + need(k) > cap) startPage(k);
        used += need(k);
        empty = false;
      }
    }
    i = j + 1;
  }
  return starts;
}
