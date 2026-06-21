import type {
  App as AppOriginal,
  Plugin
} from 'obsidian';
import type { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';

import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
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

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
  vi.spyOn(PluginSettingsTabBase.prototype, 'bind').mockImplementation((valueComponent) => valueComponent);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PluginSettingsTab', () => {
  it('should render settings when displayLegacy() is called', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    tab.displayLegacy();

    expect(getBoundKeys().length).toBeGreaterThan(0);
  });

  it('should bind invalidCharacterAction setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('invalidCharacterAction');
  });

  it('should bind replacementCharacter setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('replacementCharacter');
  });

  it('should bind shouldUpdateTitleKey setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('shouldUpdateTitleKey');
  });

  it('should bind shouldStoreInvalidTitle setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('shouldStoreInvalidTitle');
  });

  it('should bind shouldPreservePreviousDisplayTextInNoteLinks setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('shouldPreservePreviousDisplayTextInNoteLinks');
  });

  it('should bind shouldPreservePreviousDisplayTextInFrontmatterLinks setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('shouldPreservePreviousDisplayTextInFrontmatterLinks');
  });

  it('should bind shouldUpdateFirstHeader setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('shouldUpdateFirstHeader');
  });

  it('should bind shouldSupportNonMarkdownFiles setting', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('shouldSupportNonMarkdownFiles');
  });

  it('should call displayLegacy again when onChanged fires for invalidCharacterAction', async () => {
    const tab = createSettingsTab(InvalidCharacterAction.Error);
    const displaySpy = vi.spyOn(tab, 'displayLegacy');

    tab.displayLegacy();

    const onChanged = vi.mocked(PluginSettingsTabBase.prototype.bind).mock.calls.find(
      (call) => call[1] === 'invalidCharacterAction'
    )?.[2]?.onChanged;
    expect(onChanged).toBeDefined();
    await onChanged?.(InvalidCharacterAction.Error, InvalidCharacterAction.Error);

    expect(displaySpy).toHaveBeenCalledTimes(2);
  });

  it('should render without throwing when invalidCharacterAction is Replace', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Replace);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('replacementCharacter');
  });

  it('should render without throwing when invalidCharacterAction is not Replace', () => {
    const tab = createSettingsTab(InvalidCharacterAction.Remove);

    tab.displayLegacy();

    expect(getBoundKeys()).toContain('replacementCharacter');
  });
});

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
  return new PluginSettingsTab({ plugin, pluginSettingsComponent });
}

function getBoundKeys(): string[] {
  return vi.mocked(PluginSettingsTabBase.prototype.bind).mock.calls.map((call) => call[1]);
}
