/**
 * Show Changelog Command
 * Version: 1.0.4
 * Publisher: revilo - Oliver Schmidt
 * 
 * Opens the interactive changelog webview panel
 */

import * as vscode from 'vscode';
import { ChangelogPanel } from '../webviews/changelogPanel';

export function registerShowChangelogCommand(context: vscode.ExtensionContext) {
  const showChangelogCommand = vscode.commands.registerCommand(
    'extension.showChangelog',
    () => {
      ChangelogPanel.createOrShow(context.extensionUri);
    }
  );

  context.subscriptions.push(showChangelogCommand);
}
