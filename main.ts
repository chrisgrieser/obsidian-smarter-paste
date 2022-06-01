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

		// This would strip html and turn it into plain text https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData
		// --> `const clipboardText = clipboard.clipboardData.getData("text/plain");`
		// therefore, this alternative is used clipboard isn't turned into plain text
		const clipboardText = await navigator.clipboard.readText();
		if (!clipboardText) return; // stop if nothing in clipboard

		const editor = this.getEditor();
		if (!editor) return; // stop if pane isn't markdown editor

		clipboard.stopPropagation();
		clipboard.preventDefault(); // https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3801

		this.clipboardConversions(editor, clipboardText);
	}

	async clipboardConversions(editor: Editor, input: string): Promise<void> {

		const output = input
			.replace (/(?!^)(\S)-\s+(?=\w)/gm, "$1"); // remove leftover hyphens, regex uses hack to treat lookahead as lookaround https://stackoverflow.com/a/43232659

		editor.replaceSelection(output);
	}

}
