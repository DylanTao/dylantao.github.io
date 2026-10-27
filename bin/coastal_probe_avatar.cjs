// QA-only conditioning shared by the interleaved probes. A random-number seed
// cannot pin arrival identity when asynchronous page tasks consume that stream.
// Condition the actual served routine (raw or minified) equally in both variants;
// production's arrival selection and character assets stay unchanged.
function pinArrivalAvatar(source, avatar) {
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(avatar)) throw new Error("Invalid probe avatar id");
  const marker = /\bfunction\s+chooseArrivalAvatar\s*\([^)]*\)\s*\{/g;
  const matches = [...source.matchAll(marker)];
  if (matches.length !== 1) throw new Error(`Expected one named arrival selector, found ${matches.length}`);
  const at = matches[0].index + matches[0][0].length;
  const id = JSON.stringify(avatar);
  const guard = `if(!arguments[0].includes(${id}))throw new Error("Probe avatar is unavailable");return ${id};`;
  return source.slice(0, at) + guard + source.slice(at);
}

module.exports = { pinArrivalAvatar };
