import { Notice, Plugin, TFile, LinkCache, parseFrontMatterAliases } from 'obsidian';
import prompt from 'prompt';

export default class SmartRenamePlugin extends Plugin {
    private systemForbiddenCharactersRegExp: RegExp;
    private readonly obsidianForbiddenCharactersRegExp = /[#^[\]|]/;
    private currentNoteFile: TFile;
    private oldTitle: string;
    private newTitle: string | null;
    private newPath: string;
    private backlinksToFix: Map<string, Set<number>>;

    async onload(): Promise<void> {
        this.addCommand({
            id: 'smart-rename-command',
            name: 'Smart Rename',
            checkCallback: (checking: boolean): boolean => {
                if (!checking) {
                    this.smartRename();
                }
                return this.app.workspace.getActiveFile() !== null;
            }
        });

        const isWindows = document.body.hasClass('mod-windows');
        this.systemForbiddenCharactersRegExp = isWindows ? /[*"\\/<>:|?]/ : /[\\/]/;
    }

    private async smartRename(): Promise<void> {
        this.currentNoteFile = this.app.workspace.getActiveFile() as TFile;
        this.oldTitle = this.currentNoteFile.basename;
        this.newTitle = await prompt(this.app, 'Enter new title');
        this.newPath = `${this.currentNoteFile.parent.path}/${this.newTitle}.md`;

        const validationError = await this.getValidationError()
        if (validationError) {
            new Notice(validationError);
            return;
        }

        this.prepareBacklinksToFix();
        await this.addOldTitleAlias();
        await this.app.fileManager.renameFile(this.currentNoteFile, this.newPath);
        this.fixModifiedBacklinks();
    }

    private async getValidationError(): Promise<string | null> {
        if (!this.newTitle) {
            return 'No new title provided';
        }

        if (this.newTitle === this.oldTitle) {
            return 'The title did not change';
        }

        if (this.newTitle.match(this.systemForbiddenCharactersRegExp) || this.newTitle.match(this.obsidianForbiddenCharactersRegExp)) {
            return 'The new title has invalid characters';
        }

        if (await this.app.vault.adapter.exists(this.newPath)) {
            return 'Note with the new title already exists';
        }

        return null;
    }

    private prepareBacklinksToFix(): void {
        this.backlinksToFix = new Map<string, Set<number>>();

        for (const [backlinkFilePath, resolvedLinks] of Object.entries(this.app.metadataCache.resolvedLinks)) {
            if (!resolvedLinks.hasOwnProperty(this.currentNoteFile.path)) {
                continue;
            }
    
            const indicesToFix = new Set<number>();
    
            const cache = this.app.metadataCache.getCache(backlinkFilePath);
            if (cache === null) {
                continue;
            }

            const links = cache.links || [];
    
            for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
                const link = links[linkIndex];
                const linkPath = link.link.split('#')[0];
                const resolvedLinkFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, backlinkFilePath);
                if (resolvedLinkFile !== this.currentNoteFile) {
                    continue;
                }
    
                const displayText = link.displayText?.split(' > ')[0].split('/').pop();
    
                if (displayText === this.oldTitle || link.original.includes(`[${this.oldTitle}]`)) {
                    indicesToFix.add(linkIndex);
                }
            }
    
            if (indicesToFix.size > 0) {
                this.backlinksToFix.set(backlinkFilePath, indicesToFix);
            }
        }
    }

    private async addOldTitleAlias(): Promise<void> {
        await this.app.fileManager.processFrontMatter(this.currentNoteFile, (frontMatter: { aliases: string[] | string }): void => {
            const aliases = parseFrontMatterAliases(frontMatter) || [];
        
            if (!aliases.includes(this.oldTitle)) {
                aliases.push(this.oldTitle);
            }
        
            frontMatter.aliases = aliases;
        });
    }

    private async editFileLinks(filePath: string, linkProcessor: (link: LinkCache, linkIndex: number) => string | undefined): Promise<void> {
        await this.app.vault.adapter.process(filePath, (content): string => {
            let newContent = '';
            let contentIndex = 0;
            const cache = this.app.metadataCache.getCache(filePath);
            if (cache === null) {
                return content;
            }

            const links = cache.links || [];
            for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
                const link = links[linkIndex];
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

    private async fixModifiedBacklinks(): Promise<void> {
        const eventRef = this.app.metadataCache.on('resolved', async (): Promise<void> => {
            this.app.metadataCache.offref(eventRef);
    
            for (const [backlinkFilePath, indicesToFix] of this.backlinksToFix.entries()) {
                await this.editFileLinks(backlinkFilePath, (link: LinkCache, linkIndex: number): string | undefined => {
                    if (!indicesToFix.has(linkIndex)) {
                        return;
                    }

                    const isWikilink = link.original.includes(']]');
                    return isWikilink
                        ? link.original.replace(/(\|.+)?\]\]/, `|${this.oldTitle}]]`)
                        : link.original.replace(`[${this.newTitle}]`, `[${this.oldTitle}]`);
                });
            }
        });
    }
}
