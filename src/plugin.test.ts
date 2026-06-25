import type {
  App as AppOriginal,
  Command,
  PluginManifest
} from 'obsidian';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    // eslint-disable-next-line prefer-arrow-callback -- constructor stub needs `function` to be used with `new`.
    Notice: vi.fn(function NoticeStub() {
      return {
        hide: vi.fn(),
        setMessage: vi.fn()
      };
    })
  };
});

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

interface CommandsHolder {
  commands: Map<string, Command>;
}

function createApp(): AppOriginal {
  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
    cb();
  });
  return appMock.asOriginalType__();
}

async function createLoadedPlugin(app: AppOriginal): Promise<Plugin> {
  const plugin = new Plugin(app, createManifest());
  await plugin.onload();
  return plugin;
}

function createManifest(): PluginManifest {
  return strictProxy<PluginManifest>({
    id: 'smart-rename',
    name: 'Smart Rename',
    version: '1.0.0'
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('Plugin', () => {
  it('should create a plugin instance', async () => {
    const plugin = await createLoadedPlugin(createApp());
    expect(plugin).toBeInstanceOf(Plugin);
  });

  it('should register the smart rename command via its child command handler', async () => {
    const plugin = new Plugin(createApp(), createManifest());
    const addCommandSpy = vi.spyOn(plugin, 'addCommand');
    await plugin.onload();
    expect(addCommandSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'invoke', name: 'Invoke' })
    );
  });

  it('should add the plugin settings tab via its child component', async () => {
    const plugin = new Plugin(createApp(), createManifest());
    const addSettingTabSpy = vi.spyOn(plugin, 'addSettingTab');
    await plugin.onload();
    expect(addSettingTabSpy).toHaveBeenCalled();
  });

  it('should wire the registered command to check the active file via the smart rename component', async () => {
    const appMock = App.createConfigured__({ files: { 'OldTitle.md': '# OldTitle' } });
    appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
      cb();
    });
    const activeFile = appMock.vault.getFileByPath('OldTitle.md');
    appMock.workspace.getActiveFile = vi.fn(() => activeFile);
    const plugin = await createLoadedPlugin(appMock.asOriginalType__());

    const command = castTo<CommandsHolder>(plugin).commands.get('invoke');
    if (!command) {
      throw new Error('invoke command was not registered');
    }

    expect(command.checkCallback?.(true)).toBe(true);
  });
});
