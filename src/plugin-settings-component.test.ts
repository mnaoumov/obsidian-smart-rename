import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettings } from './plugin-settings.ts';

const PluginSettingsComponentBaseMock = vi.hoisted(() => {
  class MockBase {
    public readonly validators = new Map<string, (value: string) => string | undefined>();

    public constructor(_params: unknown) {
      // Call registerValidators so subclass overrides can register their validators
      this.registerValidators();
    }

    public registerValidator(key: string, fn: (value: string) => string | undefined): void {
      this.validators.set(key, fn);
    }

    protected registerValidators(): void {
      // Base no-op; subclass overrides this.
    }
  }

  return MockBase;
});

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-component', () => ({
  PluginSettingsComponentBase: PluginSettingsComponentBaseMock
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsComponent } from './plugin-settings-component.ts';

describe('PluginSettingsComponent', () => {
  function createComponent(hasInvalidCharacters: (str: string) => boolean): PluginSettingsComponent {
    return new PluginSettingsComponent({
      dataHandler: strictProxy<DataHandler>({}),
      hasInvalidCharacters,
      pluginEventSource: strictProxy<PluginEventSource>({}),
      pluginSettingsClass: PluginSettings
    });
  }

  it('should create an instance', () => {
    const component = createComponent(() => false);
    expect(component).toBeInstanceOf(PluginSettingsComponent);
  });

  it('should register a validator for replacementCharacter', () => {
    // eslint-disable-next-line no-restricted-syntax -- test needs access to mock internals via double assertion.
    const component = createComponent(() => false) as unknown as { validators: Map<string, (v: string) => string | undefined> };
    expect(component.validators.has('replacementCharacter')).toBe(true);
  });

  it('should return error message when replacement character is invalid', () => {
    // eslint-disable-next-line no-restricted-syntax -- test needs access to mock internals via double assertion.
    const component = createComponent((str) => str === '/') as unknown as { validators: Map<string, (v: string) => string | undefined> };
    const validator = component.validators.get('replacementCharacter');
    expect(validator?.('/')).toBe('Invalid replacement character');
  });

  it('should return undefined when replacement character is valid', () => {
    // eslint-disable-next-line no-restricted-syntax -- test needs access to mock internals via double assertion.
    const component = createComponent(() => false) as unknown as { validators: Map<string, (v: string) => string | undefined> };
    const validator = component.validators.get('replacementCharacter');
    expect(validator?.('_')).toBeUndefined();
  });
});
