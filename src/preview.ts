import * as vscode from "vscode";
import { Disposable } from "./disposable";

const enum PreviewState {
  Init,
  Disposed,
}

export interface Settings {
  src: string;
}

export class Preview extends Disposable {
  private _previewState = PreviewState.Init;

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel
  ) {
    super();
    const resourceRoot = resource.with({
      path: resource.path.replace(/\/[^\/]+?\.\w+$/, "/"),
    });

    webviewEditor.webview.options = {
      enableScripts: true,
      localResourceRoots: [resourceRoot, extensionRoot],
    };

    this._register(
      webviewEditor.onDidChangeViewState(() => {
        this.update();
      })
    );

    this._register(
      webviewEditor.onDidDispose(() => {
        this._previewState = PreviewState.Disposed;
      })
    );

    const watcher = this._register(
      vscode.workspace.createFileSystemWatcher(resource.fsPath)
    );

    this._register(
      watcher.onDidChange((e) => {
        if (e.toString() === this.resource.toString()) {
          this.render();
        }
      })
    );

    this._register(
      watcher.onDidDelete((e) => {
        if (e.toString() === this.resource.toString()) {
          this.webviewEditor.dispose();
        }
      })
    );

    vscode.workspace.fs.stat(resource).then(() => {
      this.update();
    });

    this.render();
    this.update();
  }

  private async render() {
    if (this._previewState !== PreviewState.Disposed) {
      this.webviewEditor.webview.html = await this.getWebviewContents();
    }
  }

  private update() {
    if (this._previewState === PreviewState.Disposed) {
      return;
    }
  }

  private async getWebviewContents(): Promise<string> {
    const version = Date.now().toString();
    const settings: Settings = {
      src: await this.getResourcePath(
        this.webviewEditor,
        this.resource,
        version
      ),
    };

    const nonce = Date.now().toString();

    const cspSource = this.webviewEditor.webview.cspSource;
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<!-- Disable pinch zooming -->
	<meta name="viewport"
		content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
	<title>STL Preview</title>
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${cspSource}; script-src 'nonce-${nonce}'; style-src ${cspSource} 'nonce-${nonce}'; connect-src https:;">
	<meta id="settings" data-settings="${escapeAttribute(
    JSON.stringify(settings)
  )}">
</head>
<body>
	<script src="${escapeAttribute(
    this.extensionResource("/out/media/main.js")
  )}" nonce="${nonce}"></script>
</body>
</html>`;
  }

  private async getResourcePath(
    webviewEditor: vscode.WebviewPanel,
    resource: vscode.Uri,
    version: string
  ): Promise<string> {
    return webviewEditor.webview
      .asWebviewUri(vscode.Uri.file(resource.fsPath))
      .with({ query: `version=${version}` })
      .toString();
  }

  private extensionResource(path: string) {
    return this.webviewEditor.webview.asWebviewUri(
      this.extensionRoot.with({
        path: this.extensionRoot.path + path,
      })
    );
  }
}

function escapeAttribute(value: string | vscode.Uri): string {
  return value.toString().replace(/"/g, "&quot;");
}
