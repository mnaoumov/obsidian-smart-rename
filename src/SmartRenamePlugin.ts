import SmartRenameSettingsTab from "./SmartRenameSettingsTab.ts";
import SmartRenameSettings from "./SmartRenameSettings.ts";
import {
  Notice,
  Plugin,
  TFile,
  type LinkCache,
  parseFrontMatterAliases,
  type CachedMetadata
} from "obsidian";
import prompt from "./prompt.ts";
import { InvalidCharacterAction } from "./InvalidCharacterAction.ts";

export default class SmartRenamePlugin extends Plugin {
  private systemForbiddenCharactersRegExp!: RegExp;
  private readonly obsidianForbiddenCharactersRegExp = /[#^[\]|]/g;
  private currentNoteFile!: TFile;
  private oldTitle!: string;
  private newTitle!: string;
  private newPath!: string;
  private readonly backlinksToFix: Map<string, Set<number>> = new Map<string, Set<number>>();
  private isReadyToFixBacklinks!: boolean;
  public settings!: SmartRenameSettings;

  public override async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "smart-rename",
      name: "Smart Rename",
      checkCallback: (checking: boolean): boolean => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
          return false;
        }

        if (!checking) {
          void this.smartRename(activeFile);
        }
        return true;
      }
    });

    this.addSettingTab(new SmartRenameSettingsTab(this.app, this));

    const isWindows = document.body.hasClass("mod-windows");
    this.systemForbiddenCharactersRegExp = isWindows ? /[*"\\/<>:|?]/g : /[\\/]/g;

    this.registerEvent(this.app.metadataCache.on("resolved", this.fixModifiedBacklinks.bind(this)));
  }

  private async smartRename(activeFile: TFile): Promise<void> {
    this.currentNoteFile = activeFile;
    this.oldTitle = this.currentNoteFile.basename;
    this.newTitle = await prompt(this.app, "Enter new title");

    let titleToStore = this.newTitle;

    if (this.hasInvalidCharacters(this.newTitle)) {
      switch (this.settings.invalidCharacterAction) {
        case InvalidCharacterAction.Error:
          new Notice("The new title has invalid characters");
          return;
        case InvalidCharacterAction.Remove:
          this.newTitle = this.replaceInvalidCharacters(this.newTitle, "");
          break;
        case InvalidCharacterAction.Replace:
          this.newTitle = this.replaceInvalidCharacters(this.newTitle, this.settings.replacementCharacter);
          break;
      }
    }

    if (!this.settings.shouldStoreInvalidTitle) {
      titleToStore = this.newTitle;
    }

    if (titleToStore && this.settings.shouldStoreInvalidTitle && titleToStore !== this.newTitle) {
      await this.addAlias(titleToStore);
    }

    if (titleToStore && this.settings.shouldUpdateTitleKey) {
      await this.app.fileManager.processFrontMatter(this.currentNoteFile, (frontMatter: { title?: string }): void => {
        frontMatter.title = titleToStore;
      });
    }

    if (titleToStore && this.settings.shouldUpdateFirstHeader) {
      await this.app.vault.process(this.currentNoteFile, content => content
        .replace(/^((---\n(.|\n)+?---\n)?(.|\n)*\n)# .+/, `$1# ${titleToStore}`));
    }

    this.newPath = `${this.currentNoteFile.parent!.path}/${this.newTitle}.md`;

    const validationError = await this.getValidationError();
    if (validationError) {
      new Notice(validationError);
      return;
    }

    this.prepareBacklinksToFix();
    await this.addAlias(this.oldTitle);

    await this.app.fileManager.renameFile(this.currentNoteFile, this.newPath);
    this.isReadyToFixBacklinks = true;
  }

  private async getValidationError(): Promise<string | null> {
    if (!this.newTitle) {
      return "No new title provided";
    }

    if (this.newTitle === this.oldTitle) {
      return "The title did not change";
    }

    if (await this.app.vault.adapter.exists(this.newPath)) {
      return "Note with the new title already exists";
    }

    return null;
  }

  private prepareBacklinksToFix(): void {
    const backlinksData = this.app.metadataCache.getBacklinksForFile(this.currentNoteFile).data;

    for (const backlinkFilePath of Object.keys(backlinksData)) {
      const indicesToFix = new Set<number>();

      const cache = this.app.metadataCache.getCache(backlinkFilePath);
      if (cache === null) {
        continue;
      }

      const linksToFix = new Set(backlinksData.get(backlinkFilePath));

      const links = this.getLinksAndEmbeds(cache);

      for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
        const link = links[linkIndex]!;
        if (!linksToFix.has(link)) {
          continue;
        }

        const displayText = link.displayText?.split(" > ")[0]?.split("/")?.pop();

        if (displayText === this.oldTitle || link.original.includes(`[${this.oldTitle}]`)) {
          indicesToFix.add(linkIndex);
        }
      }

      if (indicesToFix.size > 0) {
        this.backlinksToFix.set(backlinkFilePath, indicesToFix);
      }
    }
  }

  private async addAlias(alias: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(this.currentNoteFile, (frontMatter: { aliases: string[] | string }): void => {
      const aliases = parseFrontMatterAliases(frontMatter) || [];

      if (!aliases.includes(alias)) {
        aliases.push(alias);
      }

      frontMatter.aliases = aliases;
    });
  }

  private async editFileLinks(filePath: string, linkProcessor: (link: LinkCache, linkIndex: number) => string | void): Promise<void> {
    await this.app.vault.adapter.process(filePath, (content): string => {
      let newContent = "";
      let contentIndex = 0;
      const cache = this.app.metadataCache.getCache(filePath);
      if (cache === null) {
        return content;
      }

      const links = this.getLinksAndEmbeds(cache);

      for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
        const link = links[linkIndex]!;
        newContent += content.substring(contentIndex, link.position.start.offset);
        let newLink = linkProcessor(link, linkIndex);
        if (newLink === undefined) {
          newLink = link.original;
        }
        newContent += newLink;
        contentIndex = link.position.end.offset;
      }
      newContent += content.substring(contentIndex, content.length);
      return newContent;
    });
  }

  private getLinksAndEmbeds(cache: CachedMetadata): LinkCache[] {
    const links: LinkCache[] = [];
    if (cache.links) {
      links.push(...cache.links);
    }

    if (cache.embeds) {
      links.push(...cache.embeds);
    }

    links.sort((a, b) => a.position.start.offset - b.position.start.offset);

    return links;
  }

  private async fixModifiedBacklinks(): Promise<void> {
    if (!this.isReadyToFixBacklinks) {
      return;
    }

    this.isReadyToFixBacklinks = false;

    for (const [backlinkFilePath, indicesToFix] of this.backlinksToFix.entries()) {
      await this.editFileLinks(backlinkFilePath, (link: LinkCache, linkIndex: number): string | void => {
        if (!indicesToFix.has(linkIndex)) {
          return;
        }

        const isWikilink = link.original.includes("]]");
        return isWikilink
          ? link.original.replace(/(\|.+)?\]\]/, `|${this.oldTitle}]]`)
          : link.original.replace(`[${this.newTitle}]`, `[${this.oldTitle}]`);
      });
    }

    this.backlinksToFix.clear();
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign(new SmartRenameSettings(), await this.loadData() as SmartRenameSettings | undefined);
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  public hasInvalidCharacters(str: string): boolean {
    return this.systemForbiddenCharactersRegExp.test(str) || this.obsidianForbiddenCharactersRegExp.test(str);
  }

  private replaceInvalidCharacters(str: string, replacement: string): string {
    return str.replace(this.systemForbiddenCharactersRegExp, replacement).replace(this.obsidianForbiddenCharactersRegExp, replacement);
  }
}
