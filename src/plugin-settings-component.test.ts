import type { AsyncEventRef } from 'obsidian-dev-utils/async-events';
import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import {
  noop,
  noopAsync
} from 'obsidian-dev-utils/function';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
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
    on(name: string, callback: () => void, thisArg?: unknown): AsyncEventRef {
      return { asyncEventSource: source, callback, name, thisArg };
    }
  });
  return source;
}
