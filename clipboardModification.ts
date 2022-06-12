import { Editor } from "obsidian";

function toIso8601 (date: Date): string {
	return date
		.toLocaleString("en-GB")
		.replace(/(\d{2})\/(\d{2})\/(\d{4}).*/, "$3-$2-$1");
}

// if there is a selection, gets the content of the beginning of the selection
function getLineContent (editor: Editor) {
	const currentLineNumber = editor.getCursor("from").line;
	return editor.getLine(currentLineNumber);
}

//------------------------------------------------------------------------------

function basicModifications (str: string): string {
	return str = str
		.replace(/(\S)-\s+\n?(?=\w)/g, "$1") // remove leftover hyphens when copying from PDFs
		.replace(/\n{3,}/g, "\n\n") // remove excessive blank lines
		.replace(/(\D)[.,]\d/g, "$1") // remove footnotes from quote
		.replace(/\. ?\. ?\./g, "…") // ellipsis
		.replace(/^[\n ]+|\s+$/g, ""); // trim, except for leading tabs (usually indentaton)
}

// Adds blockquotes to all but the first line, when the cursor is in
// a blockquote line during pasting. Also works with callouts.
function blockquotify (editor: Editor, cb: string) {
	const lineContent = getLineContent(editor);

	const blockquoteRegex = /^(\s*)(>+) .*/;
	const isBlockQuoteLine = blockquoteRegex.test(lineContent);
	if (!isBlockQuoteLine) return cb;

	const indentation = lineContent.replace(blockquoteRegex, "$1");
	const blockquoteLevel = lineContent.replace(blockquoteRegex, "$2");

	// since "basicModifications" is run before and trimmed all potential
	// trailing line breaks, we do not need to care about line breaks at
	// beginning or end of the string, so this is fine
	return cb.replace(/\n/gm, `\n${indentation}${blockquoteLevel} `);
}

// when copying into a list line, prevents double list enumerations like "- - item"
function properLists (editor: Editor, cb: string) {
	const lineContent = getLineContent(editor);

	const listRegex = /^\s*[*+-] /;
	const isListLine = listRegex.test(lineContent);
	const isListClipboard = listRegex.test(cb);
	if (!isListLine || !isListClipboard) return cb;

	return cb.replace(listRegex, "");
}

function fromTwitterModifications (str: string): string {
	// copypaste from Twitter Website
	const isFromTwitter = /\[.*@(\w+).*]\(https:\/\/twitter\.com\/\w+\)\n\n(.*)$/s.test(str);

	if (isFromTwitter) {
		str = str.replace(
			/\[.*@(\w+).*]\(https:\/\/twitter\.com\/\w+\)\n\n(.*)$/gs,
			//   (nick)                                    (tweet)
			"$2\n — [@$1](https://twitter.com/$1)"
		);
	}

	return str;
}

function fromDiscordModifications (str: string): string {

	// URL from any image OR pattern from the line containing username + time
	const isFromDiscord = str.includes("https://cdn.discordapp") || /^## .*? _—_ .*:.*$/m.test(str);

	if (isFromDiscord) {
		const today = new Date();
		const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)); // JS, why u be like this? >:(
		const todayISO = toIso8601(today);
		const yesterdayISO = toIso8601(yesterday);

		str = str
			.replace( // reformat line with username + time
				/^(?:\d.)?\s*## (.*?)(?:!.*?\))? _—_ (.*)/gm,
				//  				(nick)(roleIcon)     (time)
				"__$1__ ($2)  " // two spaces for strict line breaks option
			)
			.replace(/^.*cdn\.discordapp\.com\/avatars.*?\n/gm, "") // avatars removed
			.replace(/\(Today at /g, `(${todayISO}, `) // replace relative w/ absolute date
			.replace(/\(Yesterday at /g, `(${yesterdayISO}, `)
			.replace(/^\s+/gm, "") // remove leading whitespaces
			.replace(/^\s*\n/gm, "") // remove blank lines
			.replace(/\n__/g, "\n\n__"); // add blank lines on speaker change
	}

	return str;
}

export default function clipboardModifications (editor: Editor, clipb: string): void {

	clipb = basicModifications(clipb);
	clipb = fromDiscordModifications(clipb);
	clipb = fromTwitterModifications(clipb);
	clipb = blockquotify(editor, clipb);
	clipb = properLists(editor, clipb);

	editor.replaceSelection(clipb);
}
