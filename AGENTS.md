# AGENTS.md

Developer-facing notes for this repo. User-facing documentation is the demo vault (`demo-vault/`) and `README.md`; nothing here is meant for end users.

## What the plugin does

Renames a note and rewrites its backlinks so each one **keeps displaying the old title** — `[[Old]]` becomes `[[New|Old]]`. A link that already carried display text the author chose is left alone, because a plain Obsidian rename was always correct for those.

## Layout

- `src/main.ts` — the entry point Obsidian loads; everything else hangs off `src/plugin.ts`.
- `src/smart-rename-component.ts` — the whole feature: validation, the prompt, the queued rename, and the five post-rename steps.
- `src/command-handlers/` — one handler per command (`invoke`, `invoke-on-link`).
- `src/plugin-settings.ts` / `-component.ts` / `-tab.ts` — the settings class, its persistence and its tab.
- `src/link-target.ts`, `src/invalid-character*.ts` — the two supporting concerns.

## Non-obvious design decisions

**The post-rename steps are per-rename, not per-setting.** `smartRename` seeds a mutable `PostRenameSteps` object from the settings and hands it both to the prompt's checkbox strip (which mutates it) and to the queued operation (which captures it). Nothing is written back to `data.json`: a checkbox scopes to one rename, and capturing the object means a settings change made while a rename is in flight cannot retroactively alter that rename.

**That interface deliberately does not end in `Options`.** ESLint's `obsidian-dev-utils/readonly-params-options-result-members` requires all-readonly members on any interface named `*Params` / `*Options` / `*Result`, and this one has to be mutable. `PostRenameSteps` is the name that keeps the rule honest instead of disabling it.

**Two `addAlias` calls, one checkbox.** `addAliases` gates only its first call on `shouldAddOldTitleAsAlias`. The second carries the *new* title's un-sanitized form under `shouldStoreInvalidTitle` — a different thing from carrying the old title forward — and still runs when the alias checkbox is unticked.

**The control strip is obsidian-dev-utils', not ours.** `ModalCommandBuilder` from `obsidian-dev-utils/obsidian/modals/modal-command-builder`, passed to `prompt()` as `commandBuilder`. The default `Instructions` render mode gives real inline checkboxes, which matters on mobile where there is no modifier key to press. Do not hand-roll a modal here.

## Testing traps this repo has already hit

- A unit test that renders the command strip must attach its host element to the document. jsdom fires `change` on `checkbox.click()` only for a **connected** element, and `change` is what `addCheckbox` binds `onChange` to; detached, the click toggles `checked` and notifies nobody.
- `lib.clickElement` in an integration test resolves once the click is **injected**, not once it is processed. Anything that closes the modal immediately afterwards can outrun it — `waitUntil` the expected DOM state before moving on.
- The integration harness loads `dist/build`, so a new command or a changed modal that has not been rebuilt shows up as a phantom failure. Run `npm run build` before `npm run test:integration:*`.
- A wait ceiling inside an `evalInObsidian` closure is a budget the transport will not honour. One closure is one eval, capped at ~30s, and every wait in it spends the SAME budget - so a single `WAIT_TIMEOUT_IN_MILLISECONDS` shared by six waits declares six times its value. Over the cap the eval is killed first and reported as a bare transport timeout naming the harness, so the ceiling that actually blew does not appear in the failure at all. Size such a constant for the SUM of the waits that use it, which is why the two cross-platform suites carry 4_000 and 4_500 rather than a round 20_000. If a wait genuinely needs a long budget - an aged Android emulator is the usual reason - do NOT raise the shared constant: move the waiting into Node with `pollInObsidian`, where the cap does not apply.

## Testing notes

### Why the mobile prompt frame does NOT raise the soft keyboard

Mobile frame 2 is the rename prompt, and it ends on a focused text field - so it looks like a candidate for the device-capture-with-a-keyboard treatment (`withSoftKeyboardEnabled` + `raiseSoftKeyboard` + `captureDeviceScreenshot`) that the command-palette frames in sibling plugins now use. It is not one, and the frame deliberately keeps `captureObsidianScreenshot`. Written down because the frame alone does not show it, and the next reader would reasonably try again.

The prompt is obsidian-dev-utils' `prompt` - a **centred modal**, not the bottom-anchored suggester that treatment was built for. It was never driven on this repo's frame; it was measured on the same component in two sibling plugins, which gave two different answers, neither of them a better frame:

- On one sibling's alias prompt the field does not move at all under real `adb` taps: `top` `352.4453125` before and after. So either the keyboard never arrives, or it arrives without Obsidian lifting the modal - and in that second case it covers the OK and Cancel buttons, which this frame shows in full today, along with the checkbox strip that is the whole subject of shot 2.
- On the other sibling's rename prompt the keyboard DID arrive, and brought Android's own text-selection toolbar up with it, floating across the dialog title.

So the behavior is not even consistent between two instances of one control, and what this frame stands to gain for it is a status-bar clock: `captureDeviceScreenshot` reads the framebuffer, so unlike a page capture it is not byte-reproducible and a re-capture of an unchanged frame always diffs.

**A re-attempt now fails loudly rather than silently, which is worth knowing before spending a device run on it.** `raiseSoftKeyboard` used to judge the keyboard by the field's absolute offset from the viewport bottom - a test a centred modal already passes with no keyboard at all - so it broke out of its tap loop before dispatching a single touch and reported success, and the only way to notice was to look at the frame. It now judges a **delta** against a baseline read before the first touch, and a field that never lifts throws, after writing the device framebuffer and the device's own input-method state to the diagnostics directory. That makes the no-lift shape diagnosable; it does not make the keyboard come up.

## Commands

`npm run lint` / `lint:fix`, `format:check`, `test` (unit), `test:coverage` (100% gate on all four counters), `lint:md`, `spellcheck`, `build`, then the integration projects: `test:integration:no-app`, `test:integration:desktop`, `test:integration:android`, and `npx vitest run --project=integration-tests:demo-vault`. `npm run capture:screenshots` is explicit and deliberately excluded from every integration project.

`npm run gate` runs every one of those except the integration projects, in that order. It is the release preflight itself rather than a copy of it, so it reaches `format:check`, `spellcheck`, `find-overexposed` and `test:coverage` - the four no other routine command does.
