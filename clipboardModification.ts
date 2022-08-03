import { Editor } from "obsidian";

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
		.replace(/(\D)[.,]\d/g, "$1") // remove leftover footnotes from quote
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

// when copying into a task line, prevents double tasks like "- [ ] - [ ] item"
function properTasks (editor: Editor, cb: string) {
	const lineContent = getLineContent(editor);

	const taskRegex = /^\s*- \[[ x]] /;
	const istaskLine = taskRegex.test(lineContent);
	const istaskClipboard = taskRegex.test(cb);
	if (!istaskLine || !istaskClipboard) return cb;

	return cb.replace(taskRegex, "");
}

//------------------------------------------------------------------------------

export default function clipboardModifications (editor: Editor, clipb: string): void {

	clipb = basicModifications(clipb);
	clipb = blockquotify(editor, clipb);
	clipb = properLists(editor, clipb);
	clipb = properTasks(editor, clipb);

	editor.replaceSelection(clipb); // = paste the modified content
}
