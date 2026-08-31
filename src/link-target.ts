import type {
  App,
  Editor,
  TFile
} from 'obsidian';

import { extractLinkFile } from 'obsidian-dev-utils/obsidian/link';
import {
  parseLinks,
  toParseLinkReference
} from 'obsidian-dev-utils/obsidian/parse-link';

interface ResolveLinkFileAtEditorCursorParams {
  readonly app: App;
  readonly editor: Editor;

  /**
   * The note the editor is showing, or `null` when the editor is not backed by a file. Without it a
   * relative link has nothing to resolve against.
   */
  readonly sourceFile: null | TFile;
}

/**
 * Resolves the link under the editor cursor to the file it points at.
 *
 * Deliberately parses the line rather than asking for `Editor.getClickableTokenAt`: a clickable token
 * covers only the note body, so the token approach cannot see a link inside the frontmatter block, which
 * Obsidian decorates with nothing. Reading a link cannot corrupt YAML, so unlike an *edit* this needs no
 * separate frontmatter branch.
 *
 * @param params - The parameters for the resolution.
 * @returns The linked file, or `null` when the cursor is not on a link to an existing vault file.
 */
export function resolveLinkFileAtEditorCursor(params: ResolveLinkFileAtEditorCursorParams): null | TFile {
  const { app, editor, sourceFile } = params;
  if (!sourceFile) {
    return null;
  }

  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const parseLinkResult = parseLinks(line).find((link) => link.startOffset <= cursor.ch && cursor.ch <= link.endOffset);

  // `isExternal` already covers a `file://` target: `isFileUrl` is only ever set where the url parsed as a
  // URL, so testing it too would add a branch nothing can reach.
  if (!parseLinkResult || parseLinkResult.isExternal) {
    return null;
  }

  // Only the reference's `link` is read by `extractLinkFile`, so the line offsets computed below do
  // Not matter here — every link form (wikilink, markdown, angle-bracketed, URL-encoded, embedded,
  // Subpath) resolves through this one call.
  return extractLinkFile({
    app,
    link: toParseLinkReference({ content: line, parseLinkResult }),
    sourcePathOrFile: sourceFile
  });
}
