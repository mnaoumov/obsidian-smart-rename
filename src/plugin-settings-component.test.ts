import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { AsyncEventRef } from '@mnaoumov/typescript-lib/async-events';

import {
  noop,
  noopAsync
} from '@mnaoumov/typescript-lib/function';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettings } from './plugin-settings.ts';

class MockDataHandler implements DataHandler {
  public loadData = vi.fn(() => Promise.resolve(this.data));

  private _data: unknown;

  public saveData = vi.fn((d: unknown) => {
    this._data = d;
    return noopAsync();
  });

  public get data(): unknown {
    return this._data;
  }

  public constructor(data: unknown) {
    this._data = data;
  }
}

describe('PluginSettingsComponent', () => {
  it('should create an instance', () => {
    const component = createComponent();
    expect(component).toBeInstanceOf(PluginSettingsComponent);
  });

  it('should return error message when replacement character is invalid', async () => {
    const component = createComponent();
    const settings = strictProxy<PluginSettings>({ replacementCharacter: '/' });
    const result = await component.validate(settings);
    expect(result.replacementCharacter).toBe('Invalid replacement character');
  });

  it('should return undefined when replacement character is valid', async () => {
    const component = createComponent();
    const settings = strictProxy<PluginSettings>({ replacementCharacter: '_' });
    const result = await component.validate(settings);
    expect(result.replacementCharacter).toBeUndefined();
  });
});

function createComponent(): PluginSettingsComponent {
  return new PluginSettingsComponent({
    dataHandler: new MockDataHandler({}),
    pluginEventSource: createMockPluginEventSource(),
    pluginSettingsClass: PluginSettings
  });
}

function createMockPluginEventSource(): PluginEventSource {
  const source: PluginEventSource = strictProxy<PluginEventSource>({
    offref: noop,
    on(name: string, callback: () => void, thisArgument?: unknown): AsyncEventRef {
      return { asyncEventSource: source, callback, name, thisArgument };
    }
  });
  return source;
}
