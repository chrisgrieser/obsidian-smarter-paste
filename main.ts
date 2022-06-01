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
		if (!editor) return; // stop if pane isn't markdown editor

		let clipboardText = clipboardEv.clipboardData.getData("text/html");
		if (!clipboardText) return; // e.g. when clipboard contains image

		// prevent normal pasting from occuring --> https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3801
		clipboardEv.stopPropagation();
		clipboardEv.preventDefault();

		// uses Turndown via Obsidian API to emulate the "AutoConvert HTML" setting from normal pasting
		clipboardText = htmlToMarkdown(clipboardText);

		if (clipboardEv.defaultPrevented) this.clipboardConversions(editor, clipboardText);
	}

	async clipboardConversions(editor: Editor, text: string): Promise<void> {
		const URL_REGEX = /^((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))$/;
		const todayISO = new Date()
			.toLocaleString()
			.replace(/(\d{2})\/(\d{2})\/(\d{4}).*/, "$3-$2-$1");
		const yesterdayISO = new Date()
			.setDate(new Date().getDate() - 1)
			.toLocaleString()
			.replace(/(\d{2})\/(\d{2})\/(\d{4}).*/, "$3-$2-$1");

		// GENERAL MODIFICATIONS
		// ------------------------
		text = text
			// remove leftover hyphens, regex uses hack to treat lookahead as lookaround https://stackoverflow.com/a/43232659
			.replace(/(?!^)(\S)-\s+(?=\w)/gm, "$1")

			// Remove tracker at the end of URLs
			.replace(
				URL_REGEX,
				url => url.replace(/\?.*=.*$/, "")
			);

		// SPECIFIC TEXT TYPES
		// ------------------------
		// url from any image OR pattern from the line containing username + time
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
				.replace(/\(Today at.*\)/, `(${todayISO})`) // replace relative w/ absolute date
				.replace(/\(Yesterday at.*\)/, `(${yesterdayISO})`)
				.replace(/^$/m, ""); // remove blank lines
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
