// Measured avatar support in a seat's actual world frame. The caller owns the seat polygon,
// model-byte binding and any explicitly bounded soft compression; this function guesses none.
export function fitSeatedRoot({ contact, seat, facing = 0, compression = 0 }) {
  const finite = (a, n) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
  if (
    !Number.isFinite(contact?.seatOffsetY) ||
    !finite(contact?.contactCenterXZ, 2) ||
    !finite(seat, 3) ||
    !Number.isFinite(facing) ||
    !Number.isFinite(compression) ||
    compression < 0
  )
    throw new TypeError("A measured contact, actual seat point, facing and nonnegative explicit compression are required");
  const [x, z] = contact.contactCenterXZ,
    c = Math.cos(facing),
    s = Math.sin(facing);
  return [seat[0] - c * x - s * z, seat[1] - contact.seatOffsetY - compression, seat[2] + s * x - c * z];
}
