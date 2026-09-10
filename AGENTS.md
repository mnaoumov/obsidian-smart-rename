# AGENTS.md

Developer-facing notes for this repo. User-facing documentation is the demo vault (`demo-vault/`) and
`README.md`; nothing here is meant for end users.

## What the plugin does

Renames a note and rewrites its backlinks so each one **keeps displaying the old title** — `[[Old]]`
becomes `[[New|Old]]`. A link that already carried display text the author chose is left alone, because a
plain Obsidian rename was always correct for those.

## Layout

- `src/main.ts` — the entry point Obsidian loads; everything else hangs off `src/plugin.ts`.
- `src/smart-rename-component.ts` — the whole feature: validation, the prompt, the queued rename, and the
  five post-rename steps.
- `src/command-handlers/` — one handler per command (`invoke`, `invoke-on-link`).
- `src/plugin-settings.ts` / `-component.ts` / `-tab.ts` — the settings class, its persistence and its tab.
- `src/link-target.ts`, `src/invalid-character*.ts` — the two supporting concerns.

## Non-obvious design decisions

**The post-rename steps are per-rename, not per-setting.** `smartRename` seeds a mutable `PostRenameSteps`
object from the settings and hands it both to the prompt's checkbox strip (which mutates it) and to the
queued operation (which captures it). Nothing is written back to `data.json`: a checkbox scopes to one
rename, and capturing the object means a settings change made while a rename is in flight cannot
retroactively alter that rename.

**That interface deliberately does not end in `Options`.** ESLint's
`obsidian-dev-utils/readonly-params-options-result-members` requires all-readonly members on any interface
named `*Params` / `*Options` / `*Result`, and this one has to be mutable. `PostRenameSteps` is the name
that keeps the rule honest instead of disabling it.

**Two `addAlias` calls, one checkbox.** `addAliases` gates only its first call on
`shouldAddOldTitleAsAlias`. The second carries the *new* title's un-sanitized form under
`shouldStoreInvalidTitle` — a different thing from carrying the old title forward — and still runs when
the alias checkbox is unticked.

**The control strip is ODU's, not ours.** `ModalCommandBuilder` from
`obsidian-dev-utils/obsidian/modals/modal-command-builder`, passed to `prompt()` as `commandBuilder`. The
default `Instructions` render mode gives real inline checkboxes, which matters on mobile where there is no
modifier key to press. Do not hand-roll a modal here (G61).

## Testing traps this repo has already hit

- A unit test that renders the command strip must attach its host element to the document. jsdom fires
  `change` on `checkbox.click()` only for a **connected** element, and `change` is what `addCheckbox`
  binds `onChange` to; detached, the click toggles `checked` and notifies nobody.
- `lib.clickElement` in an integration test resolves once the click is **injected**, not once it is
  processed. Anything that closes the modal immediately afterwards can outrun it — `waitUntil` the
  expected DOM state before moving on.
- The integration harness loads `dist/build`, so a new command or a changed modal that has not been
  rebuilt shows up as a phantom failure. Run `npm run build` before `npm run test:integration:*`.

## Commands

`npm run lint` / `lint:fix`, `format:check`, `test` (unit), `test:coverage` (100% gate on all four
counters), `lint:md`, `spellcheck`, `build`, then the integration projects: `test:integration:no-app`,
`test:integration:desktop`, `test:integration:android`, and `npx vitest run
--project=integration-tests:demo-vault`. `npm run capture:screenshots` is explicit and deliberately
excluded from every integration project.

`npm run gate` runs every one of those except the integration projects, in that order. It is the
release preflight itself rather than a copy of it, so it reaches `format:check`, `spellcheck`,
`find-overexposed` and `test:coverage` - the four no other routine command does.
