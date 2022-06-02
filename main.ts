import { Editor, MarkdownView, Plugin, htmlToMarkdown } from "obsidian";

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
		if (!editor) return; // pane isn't markdown editor

		const plainClipboard = clipboardEv.clipboardData.getData("text/plain");
		const htmlClipboard = clipboardEv.clipboardData.getData("text/html");
		if (!plainClipboard && !htmlClipboard) return; // e.g. when clipboard contains image

		// prevent normal pasting from occuring --> https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3801
		clipboardEv.stopPropagation();
		clipboardEv.preventDefault();

		// .getData("text/html") would ignore a plain-text clipboard
		let clipboardText;
		if (htmlClipboard) clipboardText = htmlToMarkdown(htmlClipboard); // uses Turndown via Obsidian API to emulate the "AutoConvert HTML" setting from normal pasting
		else clipboardText = plainClipboard;

		if (clipboardEv.defaultPrevented) this.clipboardConversions(editor, clipboardText);
	}

	// turns javascript date Object into ISO-8601 date
	public toIso8601 (date: Date) {
		return date
			.toLocaleString("en-GB")
			.replace(/(\d{2})\/(\d{2})\/(\d{4}).*/, "$3-$2-$1");
	}

	async clipboardConversions(editor: Editor, text: string): Promise<void> {
		const today = new Date();
		const yesterday = new Date(new Date().setDate(today.getDate() - 1)); // JS, why u be like this? >:(
		const todayISO = this.toIso8601(today);
		const yesterdayISO = this.toIso8601(yesterday);

		// GENERAL MODIFICATIONS
		// ------------------------
		// remove leftover hyphens
		text = text.replace(/(\S)-\s+(?=\w)/g, "$1");

		// SPECIFIC TEXT TYPES
		// ------------------------
		// URL from any image OR pattern from the line containing username + time
		const isFromDiscord = text.includes("https://cdn.discordapp") || /^## .*? _—_ .*:.*$/m.test(text);

		// copypaste from Twitter Website
		const isFromTwitter = /\[.*@(\w+).*]\(https:\/\/twitter\.com\/\w+\)\n\n(.*)$/s.test(text);

		if (isFromDiscord) {
			text = text
				.replace( // reformat line with username + time
					/^## (.*?)(?:!.*?\))? _—_ (.*)/gm,
					//  (nick)(roleIcon)     (time)
					"__$1__ ($2)"
				)
				.replace(/\(Today at.*\)/g, `(${todayISO})`) // replace relative w/ absolute date
				.replace(/\(Yesterday at.*\)/g, `(${yesterdayISO})`)
				.replace(/^$/gm, ""); // remove blank lines
		}

		else if (isFromTwitter) {
			text = text
				.replace(
					/\[.*@(\w+).*]\(https:\/\/twitter\.com\/\w+\)\n\n(.*)$/gs,
					//   (nick)                                    (tweet)
					"$2\n — [@$1](https://twitter.com/$1)"
				);
		}

		editor.replaceSelection(text);
	}

}
