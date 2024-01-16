import {
  App,
  Modal,
  TextComponent
} from "obsidian";

export default async function prompt(app: App, promptText: string): Promise<string> {
  return await PromptModal.getResult(app, promptText);
}

class PromptModal extends Modal {
  private resolve!: (value: string) => void;
  private promptText: string;
  private value = "";
  private isCancelled = true;
  private promise: Promise<string>;

  public constructor(app: App, promptText: string) {
    super(app);
    this.promptText = promptText;
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.open();
  }

  public onOpen(): void {
    this.titleEl.setText(this.promptText);
    const textComponent = new TextComponent(this.contentEl);
    textComponent.inputEl.style.width = "100%";
    textComponent.setPlaceholder("New title");
    textComponent.onChange(value => (this.value = value));
    textComponent.inputEl.addEventListener("keydown", (evt: KeyboardEvent): void => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        this.isCancelled = false;
        this.close();
      }
    });
  }

  public onClose(): void {
    this.resolve(this.isCancelled ? "" : this.value);
  }

  public static async getResult(app: App, promptText: string): Promise<string> {
    const modal = new PromptModal(app, promptText);
    return await modal.promise;
  }
}
