import { Plugin, Editor, MarkdownView } from "obsidian";

interface PasteFunction {
	(this: HTMLElement, ev: ClipboardEvent): void;
}

export default class SmarterPasting extends Plugin {
	pasteFunction: PasteFunction;

	async onload() {
		console.log("Tasty Pasta Plugin loaded.");

		this.pasteFunction = this.pasteUrlWithTitle.bind(this); // Listen to paste event

		this.registerEvent(
			this.app.workspace.on("editor-paste", this.pasteFunction)
		);
	}


	async onunload() { console.log("Tasty Pasta Plugin unloaded.") }

	private getEditor(): Editor {
		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeLeaf) return;
		return activeLeaf.editor;
	}

	async pasteUrlWithTitle(clipboard: ClipboardEvent): Promise<void> {

		// stop if no plain text in the clipboard
		const clipboardText = clipboard.clipboardData.getData("text/plain");
		if (!clipboardText) return;

		// stop if pane isn't markdown editor
		const editor = this.getEditor();
		if (!editor) return;

		// Prevent default paste https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3801
		clipboard.stopPropagation();
		clipboard.preventDefault();

		editor.replaceSelection("bla");
	}

}
