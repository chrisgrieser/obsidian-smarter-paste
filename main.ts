import { Editor, MarkdownView, Notice, Plugin } from "obsidian";

// add type safety for the undocumented methods
declare module "obsidian" {
	interface Vault {
		setConfig: (config: string, newValue: boolean) => void;
		getConfig: (config: string) => boolean;
	}
}

interface PasteFunction {
	(this: HTMLElement, ev: ClipboardEvent): void;
}

export default class SmarterPasting extends Plugin {
	pasteFunction: PasteFunction;

	async onload() {
		console.log("Tasty Pasta Plugin loaded.");

		this.pasteFunction = this.modifyPasting.bind(this); // Listen to paste event

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

	async modifyPasting(clipboardEv: ClipboardEvent): Promise<void> {
		const editor = this.getEditor();
		if (!editor) return; // stop if pane isn't markdown editor

		// prevent normal pasting from occuring
		// https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3801
		clipboardEv.stopImmediatePropagation();
		clipboardEv.stopPropagation();
		clipboardEv.preventDefault();

		this.ensureHTMLAutoConvertIsEnabled();

		const clipboardText = await navigator.clipboard.readText();
		if (!clipboardText) return;

		if (clipboardEv.defaultPrevented) this.clipboardConversions(editor, clipboardText);
	}

	private ensureHTMLAutoConvertIsEnabled () {
		const isDisabled = this.app.vault.getConfig("autoConvertHtml") === false;
		if (isDisabled) {
			this.app.vault.setConfig("autoConvertHtml", true);
			new Notice ("'Auto Convert HTML' setting was disabled. \n\nIt has been enabled for this plugin to work correctly.");
		}
	}

	async clipboardConversions(editor: Editor, text: string): Promise<void> {
		const todayISO = new Date()
			.toLocaleString()
			.replace(/(\d{2})\/(\d{2})\/(\d{4}).*/, "$3-$2-$1");

		// DETECT TEXT TYPES
		// ------------------
		// url from any image OR pattern from the line containing username + time
		const isFromDiscord = text.includes("https://cdn.discordapp") || /^## .*? _—_ .*:.*$/m.test(text);

		// TEXT MODIFICATIONS
		// ------------------
		text = text
			.replace (/(?!^)(\S)-\s+(?=\w)/gm, "$1"); // remove leftover hyphens, regex uses hack to treat lookahead as lookaround https://stackoverflow.com/a/43232659

		if (isFromDiscord) {
			console.log ("Discord Content");
			text = text
				.replace(/^## (.*?)(?:!.*?\))? _—_ (.*)/gm, "__$1__ ($2)") // format username + time
				//           (nick)(roleIcon)     (time)

				.replace(/\(Today at.*\)/, `(${todayISO})`); // replace relative w/ absolute date
		}

		editor.replaceSelection(text);
	}

}
