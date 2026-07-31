import type {
  App as AppOriginal,
  Plugin,
  SettingDefinition,
  SettingGroup
} from 'obsidian';
import type { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';

import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { InvalidCharacterAction } from './invalid-character-action.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { PluginSettings } from './plugin-settings.ts';

interface DisabledPredicateRow {
  disabled(): boolean;
}

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
  vi.spyOn(PluginSettingsTabBase.prototype, 'bind').mockImplementation((params) => params.valueComponent);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PluginSettingsTab', () => {
  it('should render settings when the declared rows are rendered', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    expect(getBoundKeys().length).toBeGreaterThan(0);
  });

  it('should group the rows under the expected headings', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    const headings = tab.getSettingDefinitions().map((item) => 'heading' in item ? item.heading : '');

    expect(headings).toStrictEqual(['Invalid characters', 'Title', 'Previous display text', 'Other']);
  });

  it('should bind invalidCharacterAction setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    expect(getBoundKeys()).toContain('invalidCharacterAction');
  });

  it('should bind replacementCharacter setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    expect(getBoundKeys()).toContain('replacementCharacter');
  });

  it('should bind shouldUpdateTitleKey setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    expect(getBoundKeys()).toContain('shouldUpdateTitleKey');
  });

  it('should bind shouldStoreInvalidTitle setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    expect(getBoundKeys()).toContain('shouldStoreInvalidTitle');
  });

  it('should bind shouldPreservePreviousDisplayTextInNoteLinks setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    expect(getBoundKeys()).toContain('shouldPreservePreviousDisplayTextInNoteLinks');
  });

  it('should bind shouldPreservePreviousDisplayTextInFrontmatterLinks setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    expect(getBoundKeys()).toContain('shouldPreservePreviousDisplayTextInFrontmatterLinks');
  });

  it('should bind shouldUpdateFirstHeader setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    expect(getBoundKeys()).toContain('shouldUpdateFirstHeader');
  });

  it('should bind shouldSupportNonMarkdownFiles setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    expect(getBoundKeys()).toContain('shouldSupportNonMarkdownFiles');
  });

  it('should re-evaluate the predicates in place when onChanged fires for invalidCharacterAction', async () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    renderRows(tab);

    const onChanged = vi.mocked(PluginSettingsTabBase.prototype.bind).mock.calls.find(
      (call) => call[0].propertyName === 'invalidCharacterAction'
    )?.[0].onChanged;
    expect(onChanged).toBeDefined();
    await onChanged?.(InvalidCharacterAction.Error, InvalidCharacterAction.Error);

    expect(tab.refreshDomState).toHaveBeenCalledOnce();
  });

  it('should enable the replacement character row only when invalid characters are replaced', () => {
    const replaceTab = createSettingsTab(InvalidCharacterAction.Replace);
    const removeTab = createSettingsTab(InvalidCharacterAction.Remove);

    expect(isReplacementCharacterDisabled(replaceTab)).toBe(false);
    expect(isReplacementCharacterDisabled(removeTab)).toBe(true);
  });

  it('should render without throwing when invalidCharacterAction is Replace', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Replace);

    renderRows(tab);

    expect(getBoundKeys()).toContain('replacementCharacter');
  });

  it('should render without throwing when invalidCharacterAction is not Replace', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Remove);

    renderRows(tab);

    expect(getBoundKeys()).toContain('replacementCharacter');
  });
});

/**
 * Flattens the declared items into the rows they contain, unwrapping the groups.
 *
 * @param tab - The settings tab.
 * @returns The declared rows.
 */
function collectRows(tab: PluginSettingsTab): SettingDefinition[] {
  const rows: SettingDefinition[] = [];
  for (const item of tab.getSettingDefinitions()) {
    if ('items' in item) {
      rows.push(...castTo<SettingDefinition[]>(item.items ?? []));
    } else {
      rows.push(castTo<SettingDefinition>(item));
    }
  }

  return rows;
}

function createMockPlugin(appInstance: AppOriginal): Plugin {
  return strictProxy<Plugin>({
    app: appInstance,
    manifest: { id: 'smart-rename' }
  });
}

function createMockSettingsComponent(invalidCharacterAction: InvalidCharacterAction): PluginSettingsComponentBase<PluginSettings> {
  const settings = new PluginSettings();
  settings.invalidCharacterAction = invalidCharacterAction;
  const defaultSettings = new PluginSettings();
  return strictProxy<PluginSettingsComponentBase<PluginSettings>>({
    defaultSettings,
    on: castTo<PluginSettingsComponentBase<PluginSettings>['on']>(vi.fn(() => ({
      asyncEventSource: {
        offref: vi.fn()
      }
    }))),
    revalidate: vi.fn(() => Promise.resolve(castTo<Record<keyof PluginSettings, string>>({}))),
    saveToFile: vi.fn(() => noopAsync()),
    setProperty: vi.fn(() => Promise.resolve('')),
    settings,
    settingsState: {
      effectiveValues: settings,
      inputValues: settings,
      validationMessages: castTo<Record<keyof PluginSettings, string>>({})
    }
  });
}

function createSettingsTab(invalidCharacterAction: InvalidCharacterAction): PluginSettingsTab {
  const plugin = createMockPlugin(app);
  const pluginSettingsComponent = createMockSettingsComponent(invalidCharacterAction);
  const tab = new PluginSettingsTab({ plugin, pluginSettingsComponent });
  // The dropdown's `onChanged` asks Obsidian to re-evaluate the `disabled` predicates in place; there is no
  // Rendered tab in a unit test, so neutralize it.
  tab.refreshDomState = vi.fn();
  return tab;
}

function getBoundKeys(): string[] {
  return vi.mocked(PluginSettingsTabBase.prototype.bind).mock.calls.map((call) => call[0].propertyName);
}

/**
 * Evaluates the replacement-character row's `disabled` predicate.
 *
 * @param tab - The settings tab.
 * @returns Whether the row is disabled.
 */
function isReplacementCharacterDisabled(tab: PluginSettingsTab): boolean {
  const row = collectRows(tab).find((definition) => 'name' in definition && definition.name === 'Replacement character');
  return castTo<DisabledPredicateRow>(row).disabled();
}

/**
 * Invokes every declared row's `render` callback the way Obsidian does when the tab is opened, so the
 * bindings are still exercised now that the rows are declarative.
 *
 * @param tab - The settings tab.
 */
function renderRows(tab: PluginSettingsTab): void {
  for (const row of collectRows(tab)) {
    if ('render' in row) {
      row.render(new SettingEx(tab.containerEl), castTo<SettingGroup>(null));
    }
  }
}
