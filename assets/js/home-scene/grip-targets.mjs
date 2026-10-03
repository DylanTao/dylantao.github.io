// Equipment anchors describe cylinder centers. An articulated avatar can name
// a different anatomical wrist target for specific clips, in Y-up local meters.
// Missing metadata leaves the existing coffee, walking and other targets intact.
export function resolveWristTargets(contacts, clip, offsets, yaw) {
  const pair = offsets?.[clip];
  if (!contacts || !pair) return contacts;
  const cosine = Math.cos(yaw),
    sine = Math.sin(yaw);
  return contacts.map((contact, side) => {
    const offset = pair[side];
    if (!contact || !offset) return contact;
    const [x, y, z] = offset;
    return [contact[0] + x * cosine + z * sine, contact[1] + y, contact[2] - x * sine + z * cosine];
  });
}
