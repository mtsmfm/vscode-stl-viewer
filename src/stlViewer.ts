import * as vscode from "vscode";
import { Preview } from "./preview";

export class StlViewer implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = "stlViewer.previewEditor";

  private readonly _previews = new Set<Preview>();

  constructor(private readonly extensionRoot: vscode.Uri) {}

  public async openCustomDocument(uri: vscode.Uri) {
    return { uri, dispose: () => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewEditor: vscode.WebviewPanel
  ): Promise<void> {
    const preview = new Preview(
      this.extensionRoot,
      document.uri,
      webviewEditor
    );
    this._previews.add(preview);

    webviewEditor.onDidDispose(() => {
      this._previews.delete(preview);
    });
  }
}
