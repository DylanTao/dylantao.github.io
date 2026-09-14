// Shared, deterministic motion and copy. No page text is rewritten by P.
export function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let n = Math.imul(value ^ (value >>> 15), 1 | value);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function spring(position, velocity, target, dt, frequency = 3.5) {
  dt = Math.max(0, Math.min(dt, 0.05));
  const d = position - target,
    c = velocity + frequency * d,
    decay = Math.exp(-frequency * dt);
  return [target + (d + c * dt) * decay, (velocity - frequency * c * dt) * decay];
}

export function clearAt(x, y, obstacles, size = 82) {
  const w = size * 0.39,
    h = size * 0.48;
  return !obstacles.some((r) => x + w > r.left - 5 && x - w < r.right + 5 && y + h > r.top - 5 && y - h < r.bottom + 5);
}

export function choosePerch({ width, height, preferred, obstacles, size = 82, rail }) {
  const padding = size * 0.5 + 7;
  const xs = [preferred.x, width - padding, padding, rail?.right + padding, rail?.left - padding, width * 0.72, width * 0.5, width * 0.28].filter(
    Number.isFinite
  );
  const ys = [preferred.y, height - padding - 12];
  for (let y = 115; y < height - padding; y += size * 0.9) ys.push(y);
  const candidates = [];
  for (const x of xs)
    for (const y of ys) {
      if (x < padding || x > width - padding || y < 95 || y > height - padding || !clearAt(x, y, obstacles, size)) continue;
      candidates.push({ x, y, score: Math.hypot(x - preferred.x, (y - preferred.y) * 0.8) });
    }
  return candidates.sort((a, b) => a.score - b.score)[0] || null;
}

const lines = {
  home: ["A little room for curiosity.", "Make yourself at home.", "Just having a look."],
  projects: ["This one started with a question.", "Tiny steps. Lots of drafts.", "Shall we look closer?"],
  designweaver: ["A few possibilities to try.", "Same question, different ideas."],
  publications: ["This one has receipts.", "The details live in the paper.", "Happy reading."],
  blog: ["I saved you a quiet corner.", "Take your time.", "One more paragraph?"],
  cv: ["A few chapters so far.", "Still a work in progress."],
  research: ["Good questions take a little wandering.", "I like this question."],
  contact: ["Hope you found something interesting.", "Thanks for stopping by."],
  hello: ["Oh, hello!", "You found me.", "Boop received."],
  catchup: ["There you are.", "Wait for me!", "Found you."],
  bump: ["Oops. One sec.", "I can fix that.", "That was me."],
  repair: ["There. All better.", "Back where it belongs.", "Tiny repair, complete."],
};
export function phrase(path, section, event, random = Math.random) {
  const context = `${path} ${section}`.toLowerCase();
  const key = event || ["designweaver", "publications", "projects", "blog", "research", "contact", "cv"].find((k) => context.includes(k)) || "home";
  const choices = lines[key] || lines.home;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}
