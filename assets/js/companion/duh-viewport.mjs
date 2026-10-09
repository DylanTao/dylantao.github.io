import { choosePerch, clearAt } from "./behaviour.mjs";

// Preserve P's preferred placement, then find short gaps its coarse row grid
// can miss between an iPhone's reading block and interactive coastal footer.
export function chooseDuhPerch(view, bounds, preferred, obstacles, rail) {
  const local = (r) => ({ left: r.left - view.left, right: r.right - view.left, top: r.top - view.top, bottom: r.bottom - view.top });
  const selected = choosePerch({
    width: view.width,
    height: view.height - view.bottom,
    preferred: { x: preferred.x - view.left, y: preferred.y - view.top },
    obstacles: obstacles.map(local),
    size: 100,
    rail: rail ? local(rail) : undefined,
  });
  const inside = (p) => p.x >= bounds.left && p.x <= bounds.right && p.y >= bounds.top && p.y <= bounds.bottom;
  if (selected) {
    const p = { x: selected.x + view.left, y: selected.y + view.top };
    if (inside(p)) return p;
  }
  const xs = [preferred.x, bounds.left, bounds.right, (bounds.left + bounds.right) / 2];
  const ys = [preferred.y, ...new Set(obstacles.flatMap((r) => [r.top - 54, r.bottom + 54]).map((y) => Math.round(y * 2) / 2))];
  return (
    xs
      .flatMap((x) => ys.map((y) => ({ x, y })))
      .filter(inside)
      .sort((a, b) => Math.hypot(a.x - preferred.x, (a.y - preferred.y) * 0.8) - Math.hypot(b.x - preferred.x, (b.y - preferred.y) * 0.8))
      .find((p) => clearAt(p.x, p.y, obstacles, 96)) || null
  );
}
