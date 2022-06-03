import { Editor, MarkdownView, Plugin, htmlToMarkdown } from "obsidian";

interface PasteFunction {
	(this: HTMLElement, ev: ClipboardEvent): void;
}

export default class SmarterPasting extends Plugin {
	pasteFunction: PasteFunction;

	async onload() {
		console.log("Pasta Copinara Plugin loaded.");

		this.pasteFunction = this.modifyPasteEvent.bind(this); // Listen to paste event

		this.registerEvent(
			this.app.workspace.on("editor-paste", this.pasteFunction)
		);
	}
	async onunload() { console.log("Pasta Copinara Plugin unloaded.") }

	private getEditor(): Editor {
		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeLeaf) return;
		return activeLeaf.editor;
	}

	async modifyPasteEvent (clipboardEv: ClipboardEvent): Promise<void> {
		const editor = this.getEditor();
		if (!editor) return; // pane isn't markdown editor

		// check for plain text, too, since getData("text/html") ignores plain-text
		const plainClipboard = clipboardEv.clipboardData.getData("text/plain");
		const htmlClipboard = clipboardEv.clipboardData.getData("text/html");
		if (!plainClipboard && !htmlClipboard) return; // e.g. when clipboard contains image

		// prevent conflict with Auto Title Link Plugin
		const linkRegex = /^((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))$/i;
		if (linkRegex.test(plainClipboard.trim())) {
			console.log("Pasta Copinara aborted due to being link to avoid conflict with the Auto Title Link Plugin.");
			return;
		}

		// prevent normal pasting from occuring --> https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3801
		clipboardEv.stopPropagation();
		clipboardEv.preventDefault();

		let clipboardText;
		if (htmlClipboard) clipboardText = htmlToMarkdown(htmlClipboard); // uses Turndown via Obsidian API to emulate the "AutoConvert HTML" setting from normal pasting
		else clipboardText = plainClipboard;

		if (clipboardEv.defaultPrevented) this.clipboardConversions(editor, clipboardText);
	}

	// turns js-date into ISO-8601 date-string
	public toIso8601 (date: Date) {
		return date
			.toLocaleString("en-GB")
			.replace(/(\d{2})\/(\d{2})\/(\d{4}).*/, "$3-$2-$1");
	}

	async clipboardConversions (editor: Editor, text: string): Promise<void> {
		// ISO Date for relative date replacements
		const today = new Date();
		const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)); // JS, why u be like this? >:(
		const todayISO = this.toIso8601(today);
		const yesterdayISO = this.toIso8601(yesterday);

		// GENERAL MODIFICATIONS
		// ------------------------
		text = text
			.replace(/(\S)-\s+\n?(?=\w)/g, "$1") // remove leftover hyphens when copying from PDFs
			.replace(/\n{3,}/g, "\n\n") // remove excessive blank lines
			.trim();

		// SPECIFIC TEXT TYPES
		// ------------------------
		// URL from any image OR pattern from the line containing username + time
		const isFromDiscord = text.includes("https://cdn.discordapp") || /^## .*? _—_ .*:.*$/m.test(text);

		// copypaste from Twitter Website
		const isFromTwitter = /\[.*@(\w+).*]\(https:\/\/twitter\.com\/\w+\)\n\n(.*)$/s.test(text);

		if (isFromDiscord) {
			text = text
				.replace( // reformat line with username + time
					/^(?:\d.)?\s*## (.*?)(?:!.*?\))? _—_ (.*)/gm,
					//  				(nick)(roleIcon)     (time)
					"__$1__ ($2)  " // two spaces for strict line breaks option
				)
				.replace(/^.*cdn\.discordapp\.com\/avatars.*?\n/gm, "") // avatars removed
				.replace(/\(Today at.*\)/g, `(${todayISO})`) // replace relative w/ absolute date
				.replace(/\(Yesterday at.*\)/g, `(${yesterdayISO})`)
				.replace(/^\s+/gm, "") // remove leading whitespaces
				.replace(/^\s*\n/gm, "") // remove blank lines
				.replace(/\n__/g, "\n\n__"); // add blank lines speaker change
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
