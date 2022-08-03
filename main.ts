import { Editor, MarkdownView, Notice, Plugin, htmlToMarkdown } from "obsidian";
import clipboardModifications from "clipboardModification";

interface PasteFunction {
	(this: HTMLElement, ev: ClipboardEvent): void;
}

// add type safety for the undocumented methods
declare module "obsidian" {
	interface Vault {
		getConfig: (config: string) => boolean;
	}
}

export default class SmarterPasting extends Plugin {
	pasteFunction: PasteFunction;

	async onload() {
		console.log("Pasta Copinara Plugin loaded.");

		this.pasteFunction = this.modifyPasteEvent.bind(this); // Listen to paste event

		this.registerEvent(
			this.app.workspace.on("editor-paste", this.pasteFunction)
		);

		this.addCommand({
			id: "paste-as-plain-text",
			name: "Paste as Plain Text & without Modifications",
			editorCallback: (editor) => this.pasteAsPlainText(editor),
		});


	}
	async onunload() { console.log("Pasta Copinara Plugin unloaded.") }

	private getEditor(): Editor {
		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeLeaf) return;
		return activeLeaf.editor;
	}

	// INFO: to inspect clipboard content types, use https://evercoder.github.io/clipboard-inspector/
	async modifyPasteEvent (clipboardEv: ClipboardEvent): Promise<void> {

		// abort when pane isn't markdown editor
		const editor = this.getEditor();
		if (!editor) return;

		// abort when clipboard contains an image (or is empty)
		// check for plain text, since 'getData("text/html")' ignores plain-text
		const plainClipboard = clipboardEv.clipboardData.getData("text/plain");
		if (!plainClipboard) return;

		// Abort when clipboard has URL, to prevent conflict with the plugins
		// Auto Title Link & Paste URL into Selection
		// has to search the entire clipboard (not surrounding the regex with ^$),
		// because otherwise having 2 URLs cause Obsidian-breaking conflict
		const urlRegex = /((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))/i;
		if (urlRegex.test(plainClipboard.trim())) {
			console.log("Pasta Copinara aborted due as the clipboard is a link to avoid conflict with other plugins that modify pasting.");
			return;
		}

		// prevent default pasting & abort when not successful
		clipboardEv.stopPropagation();
		clipboardEv.preventDefault();
		if (!clipboardEv.defaultPrevented) return;

		// use Turndown via Obsidian API to emulate "Auto Convert HTML" setting
		const convertHtmlEnabled = this.app.vault.getConfig("autoConvertHtml");
		const htmlClipb = clipboardEv.clipboardData.getData("text/html");
		const clipboardText = htmlClipb && convertHtmlEnabled ? htmlToMarkdown(htmlClipb) : plainClipboard;

		// if everything went well, run clipboard modifications (also passing
		// editor is necessary so clipboard text can be modified based on cursor
		// position)
		clipboardModifications(editor, clipboardText);
	}

	async pasteAsPlainText (editor: Editor): Promise<void> {
		const clipboardContent = await navigator.clipboard.readText();
		if (!clipboardContent) {
			new Notice ("There is no clipboard content.");
			return;
		}
		editor.replaceSelection(clipboardContent);
	}

}
