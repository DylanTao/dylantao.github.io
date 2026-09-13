// One companion moves between the DOM reading surface and the miniature.
// Neither renderer owns a second copy of its mood, nap or pointer state.
export const companion = {
  owner: "page",
  theme: "noon",
  reduced: false,
  napping: false,
  paused: false,
  pointer: { x: 0, y: 0, at: 0 },
  projected: null,
  worldReady: false,
  mood: 0,
  boops: 0,
  excursion: false,
  room: "study",
};

export const companionLights = {
  morning: { accent: [0.42, 0.7, 0.48], lamp: [1, 0.92, 0.8] },
  noon: { accent: [0.18, 0.73, 0.72], lamp: [0.94, 0.98, 1] },
  afternoon: { accent: [0.95, 0.54, 0.2], lamp: [1, 0.82, 0.58] },
  evening: { accent: [0.58, 0.51, 1], lamp: [1, 0.69, 0.45] },
};
