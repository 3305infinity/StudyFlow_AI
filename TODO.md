# TODO (StudyFlow Shadow DOM focus fix)

- [x] Inspect injectSidebar.ts (shadow host + attachShadow)
- [x] Remove keyboard interception / focus retarget hacks from src/content/index.ts; keep only focus/keydown logging.
- [x] Fix shadow DOM focus model: use `delegatesFocus: true` and stop blocking pointer events on the shadow host.
- [x] Add ChatPanel input focus/keydown logging with element identity checks.
- [ ] Verify React/Framer Motion does not remount the input during typing (confirm no key/conditional remount around the input).
- [ ] Re-run build after lint verification and validate in browser that:
  - `shadowRoot.activeElement` == the real input/textarea during typing
  - `document.activeElement` also points to the real node (not necessarily required, but should not drift to host)
- [ ] If focus still drifts, inspect Sidebar/child components for conditional remount/key changes during typing.

