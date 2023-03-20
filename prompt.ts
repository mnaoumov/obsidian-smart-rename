import { App, Modal, TextComponent } from 'obsidian';

async function prompt(app: App, promptText: string): Promise<string | null> {
    const modal = new PromptModal(app, promptText);
    return await modal.getResult();
}

class PromptModal extends Modal {
    private promiseResolve: (value: string | null) => void;
    private promptText: string;
    private value: string;
    private isCancelled: boolean = true;

    constructor(app: App, promptText: string) {
        super(app);
        this.promptText = promptText;
    }

    onOpen(): void {
        this.titleEl.setText(this.promptText);
        const textInput = new TextComponent(this.contentEl);
        textInput.setPlaceholder('Type text here');
        textInput.onChange(value => (this.value = value));
        textInput.inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
            if (evt.key === 'Enter') {
                evt.preventDefault();
                this.isCancelled = false;
                this.close();
                this.promiseResolve(this.value);
            }
        });
    }

    onClose(): void {
        if (this.isCancelled) {
            this.promiseResolve(null);
        }
    }

    async getResult(): Promise<string | null> {
        this.open();
        return new Promise(resolve => {
            this.promiseResolve = resolve
        });
    }
}

export default prompt;
