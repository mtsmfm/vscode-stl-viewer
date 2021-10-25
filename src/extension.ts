import * as vscode from "vscode";
import { StlViewer } from "./stlViewer";

export function activate(context: vscode.ExtensionContext) {
  const stlViewer = new StlViewer(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(StlViewer.viewType, stlViewer, {
      supportsMultipleEditorsPerDocument: true,
    })
  );
}
