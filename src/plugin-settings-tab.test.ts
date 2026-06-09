/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/no-useless-constructor, no-restricted-syntax -- Test mocks require empty constructors and flexible patterns. */
import type { PluginSettingsTabBaseConstructorParams } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';

import { castTo } from 'obsidian-dev-utils/object-utils';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettings } from './plugin-settings.ts';

const hoisted = vi.hoisted(() => {
  const boundKeys: string[] = [];
  const onChangedCallbacks: (() => void)[] = [];

  class PluginSettingsTabBaseMock {
    public containerEl = activeDocument.createElement('div');

    public pluginSettingsComponent = {
      settings: {
        // Use the string value directly since InvalidCharacterAction is not importable in hoisted context.
        invalidCharacterAction: 'Error'
      }
    };

    public constructor(_params: unknown) {}

    public bind(component: unknown, key: string, options?: { onChanged?(): void }): unknown {
      boundKeys.push(key);
      if (options?.onChanged) {
        onChangedCallbacks.push(options.onChanged);
      }
      return component;
    }

    public display(): void {}
  }

  return { boundKeys, onChangedCallbacks, PluginSettingsTabBaseMock };
});

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-settings-tab', () => ({
  PluginSettingsTabBase: hoisted.PluginSettingsTabBaseMock
}));

vi.mock('obsidian-dev-utils/html-element', () => ({
  appendCodeBlock: vi.fn()
}));

const MockSettingExHoisted = vi.hoisted(() => {
  class MockDropdown {
    public addOptions(_opts: Record<string, string>): this {
      return this;
    }
  }

  class MockText {
    public inputEl = { maxLength: 0 };
  }

  class MockSettingEx {
    public addDropdown(cb: (dropdown: MockDropdown) => void): this {
      cb(new MockDropdown());
      return this;
    }

    public addText(cb: (text: MockText) => void): this {
      cb(new MockText());
      return this;
    }

    public addToggle(cb: (toggle: object) => void): this {
      cb({});
      return this;
    }

    public setDesc(_desc: unknown): this {
      return this;
    }

    public setDisabled(_disabled: boolean): this {
      return this;
    }

    public setName(_name: string): this {
      return this;
    }
  }

  return { MockSettingEx };
});

vi.mock('obsidian-dev-utils/obsidian/setting-group-ex', () => ({
  SettingGroupEx: class MockSettingGroupEx {
    public constructor(_containerEl: HTMLElement) {}

    public addSettingEx(cb: (setting: InstanceType<typeof MockSettingExHoisted.MockSettingEx>) => void): this {
      cb(new MockSettingExHoisted.MockSettingEx());
      return this;
    }

    public setHeading(_heading: string): this {
      return this;
    }
  }
}));

vi.mock('obsidian-dev-utils/obsidian/setting-ex', () => ({
  SettingEx: MockSettingExHoisted.MockSettingEx
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsTab } from './plugin-settings-tab.ts';

describe('PluginSettingsTab', () => {
  function createSettingsTab(): PluginSettingsTab {
    return new PluginSettingsTab(castTo<PluginSettingsTabBaseConstructorParams<PluginSettings>>({}));
  }

  it('should create an instance', () => {
    const tab = createSettingsTab();
    expect(tab).toBeInstanceOf(PluginSettingsTab);
  });

  it('should render settings when display() is called', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    expect(hoisted.boundKeys.length).toBeGreaterThan(0);
  });

  it('should bind invalidCharacterAction setting', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    expect(hoisted.boundKeys).toContain('invalidCharacterAction');
  });

  it('should bind replacementCharacter setting', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    expect(hoisted.boundKeys).toContain('replacementCharacter');
  });

  it('should bind shouldUpdateTitleKey setting', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    expect(hoisted.boundKeys).toContain('shouldUpdateTitleKey');
  });

  it('should bind shouldStoreInvalidTitle setting', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    expect(hoisted.boundKeys).toContain('shouldStoreInvalidTitle');
  });

  it('should bind shouldPreservePreviousDisplayTextInNoteLinks setting', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    expect(hoisted.boundKeys).toContain('shouldPreservePreviousDisplayTextInNoteLinks');
  });

  it('should bind shouldPreservePreviousDisplayTextInFrontmatterLinks setting', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    expect(hoisted.boundKeys).toContain('shouldPreservePreviousDisplayTextInFrontmatterLinks');
  });

  it('should bind shouldUpdateFirstHeader setting', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    expect(hoisted.boundKeys).toContain('shouldUpdateFirstHeader');
  });

  it('should bind shouldSupportNonMarkdownFiles setting', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    expect(hoisted.boundKeys).toContain('shouldSupportNonMarkdownFiles');
  });

  it('should call display again when onChanged fires for invalidCharacterAction', () => {
    const tab = createSettingsTab();
    hoisted.boundKeys.length = 0;
    hoisted.onChangedCallbacks.length = 0;
    const displaySpy = vi.spyOn(tab, 'display');

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- display() is the entry point for PluginSettingsTabBase; calling it in tests is intentional.
    tab.display();
    const callback = hoisted.onChangedCallbacks[0];
    expect(callback).toBeDefined();
    callback?.();
    expect(displaySpy).toHaveBeenCalledTimes(2);
  });
});
/* eslint-enable @typescript-eslint/no-empty-function, @typescript-eslint/no-useless-constructor, no-restricted-syntax -- End of test file. */
