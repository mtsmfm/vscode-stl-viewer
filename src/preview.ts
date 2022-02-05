import * as vscode from "vscode";
import * as THREE from "three";
import { readFileSync } from "fs";
import { Disposable } from "./disposable";

const enum PreviewState {
  Init,
  Disposed,
}

export interface Settings {
  showViewButtons: boolean;
  viewOffset: number;
  showInfo: boolean;
  showAxes: boolean;
  showBoundingBox: boolean;
  grid: {
    enable: boolean;
    color: THREE.ColorRepresentation;
  };
  meshMaterial:
    | {
        type: "phong";
        config: THREE.MeshPhongMaterialParameters;
      }
    | {
        type: "lambert";
        config: THREE.MeshLambertMaterialParameters;
      }
    | {
        type: "normal";
        config: THREE.MeshNormalMaterialParameters;
      }
    | {
        type: "basic";
        config: THREE.MeshBasicMaterialParameters;
      }
    | {
        type: "standard";
        config: THREE.MeshStandardMaterialParameters;
      };
  data: string;
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

  private getSettings(): Settings {
    const config = vscode.workspace.getConfiguration("stlViewer");
    const settings: Settings = {
      showInfo: config.showInfo,
      showAxes: config.showAxes,
      showBoundingBox: config.showBoundingBox,
      showViewButtons: config.showViewButtons,
      viewOffset: config.viewOffset,
      grid: {
        enable: config.showGrid,
        color: config.gridColor,
      },
      meshMaterial: {
        type: config.meshMaterialType,
        config: config.meshMaterialConfig,
      },
      data: readFileSync(this.resource.fsPath, { encoding: "base64" }),
    };

    return settings;
  }

  private async getWebviewContents(): Promise<string> {
    const settings = this.getSettings();
    const nonce = Date.now().toString();

    const cspSource = this.webviewEditor.webview.cspSource;
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<!-- Disable pinch zooming -->
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
	<title>STL Preview</title>
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${cspSource}; script-src 'nonce-${nonce}'; style-src ${cspSource} 'nonce-${nonce}'; connect-src https:;">
	<meta id="settings" data-settings="${escapeAttribute(
    JSON.stringify(settings)
  )}">
  <link rel="stylesheet" type="text/css" href="${escapeAttribute(
    this.extensionResource("/out/media/main.css")
  )}">
</head>
<body>
  <div id="viewer">
    <div class="actions">
      <!--<button class="button button--fit">Fit to view</button>-->
      <button class="button button--isometric">Isometric</button>
      <button class="button button--top">Top</button>
      <button class="button button--left">Left</button>
      <button class="button button--right">Right</button>
      <button class="button button--bottom">Bottom</button>
    </div>
  </div>
	<script src="${escapeAttribute(
    this.extensionResource("/out/media/main.js")
  )}" nonce="${nonce}"></script>
</body>
</html>`;
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
