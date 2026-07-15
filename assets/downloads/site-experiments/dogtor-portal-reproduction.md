# Discoverable Secret Portal Reproduction Brief

Use this brief to make an optional hidden journey on your own site. It intentionally contains no destination URL, credential, private content, visitor record, analytics endpoint, or precise location.

## Visitor contract

- The public page remains complete without finding the secret.
- A small meaningful object acts as the discoverable trigger.
- Activating it opens a real modal with a clear prompt, visible choices, and a close path.
- Every offered choice should produce truthful feedback; do not fake one correct answer when all choices are valid.
- A successful pass lasts only for the current browser-tab session.
- Direct entry without a pass shows a real heading, a short explanation, and one route back to the public entry.

## Privacy boundary

- Keep the destination and private content out of public case studies and reproduction notes.
- Never embed real credentials in client code.
- Approximate location may be shown only from privacy-safe edge context.
- Request precise browser location only through an explicit action; unknown or denied permission remains understandable and retryable.
- Do not publish raw visitor or analytics data.

## Modal access

- Move focus into the modal on open and contain Tab order.
- Escape and backdrop close cancel pending navigation.
- Restore focus to the trigger on close.
- Reduced motion keeps the same feedback and navigation without decorative animation.

## Acceptance checks

- Verify pointer, touch, keyboard, focus containment, Escape, backdrop close, and focus return.
- Verify refresh/back recovery in the same tab and a locked state in a new session.
- Verify direct entry never reveals the private destination or content.
- Verify unknown, granted, and denied location permission states without automatic prompts.

## Copy-ready coding-agent prompt

> Add an optional secret journey to my site using my own public trigger and private destination. Keep the public page complete without it. Build an accessible modal with visible choices, truthful feedback, focus containment, Escape/backdrop close, focus return, a session-scoped pass, and a clear locked direct-entry fallback. Never expose credentials, private content, visitor records, analytics endpoints, or the destination in public documentation. Ask for precise location only after an explicit action, and provide complete reduced-motion and denial states.

## Credit boundary

Use your own character, story, destination, and artwork. The transferable lesson is that hidden delight still needs explicit recovery, consent, and privacy boundaries.
