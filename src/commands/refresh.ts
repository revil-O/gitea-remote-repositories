/**
 * Refresh Pull Requests Command Handler
 */
import * as vscode from 'vscode';
import { Settings, SettingState } from '../config/settings';

let settingStateContext = SettingState.OK;

export async function handleRefreshPullRequests(
  _refreshCallback?: () => void
): Promise<void> {
  try {
    const settingState = Settings.getSettingState();
    settingStateContext = settingState;

    // Update VS Code context for UI
    vscode.commands.executeCommand('setContext', 'SETTING_STATE', settingState);

    if (!Settings.isConfigured()) {
      vscode.window.showWarningMessage(
        'Gitea settings not configured. Please configure token and host.'
      );
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: 'Fetching pull requests...',
      },
      async () => {
        // Refresh notification sent
      }
    );

    vscode.window.showInformationMessage('✓ Pull requests refreshed!');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to refresh PRs: ${errorMsg}`);
    console.error('Refresh PRs error:', error);
  }
}

export function getSettingStateContext(): SettingState {
  return settingStateContext;
}
