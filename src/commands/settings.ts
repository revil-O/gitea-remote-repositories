/**
 * Settings Command Handlers
 */
import * as vscode from 'vscode';
import { Settings } from '../config/settings';
import { GiteaClient } from '../giteaApi/client';

export async function handleSettingToken(): Promise<void> {
  try {
    const token = await vscode.window.showInputBox({
      prompt: 'Enter your Gitea API token',
      password: true,
      placeHolder: 'Your API token',
      validateInput: (value) => {
        if (!value) {
          return 'Token cannot be empty';
        }
        return null;
      },
    });

    if (token === undefined) {
      return; // User cancelled
    }

    await Settings.setToken(token);

    // Verify token by checking user endpoint
    try {
      const client = new GiteaClient();
      const user = await client.getCurrentUser();
      vscode.window.showInformationMessage(`✓ Token saved! Logged in as: ${user.login}`);
    } catch (error) {
      vscode.window.showErrorMessage('Token is invalid or cannot reach Gitea server.');
      await Settings.setToken(''); // Clear invalid token
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to save token: ${errorMsg}`);
    console.error('Token setting error:', error);
  }
}

export async function handleSettingHost(): Promise<void> {
  try {
    const host = await vscode.window.showInputBox({
      prompt: 'Enter your Gitea API address',
      placeHolder: 'e.g., http://localhost:3000/api/v1',
      validateInput: (value) => {
        if (!value) {
          return 'Host cannot be empty';
        }
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return 'Host must start with http:// or https://';
        }
        if (!value.includes('/api/v1')) {
          return 'Host should include /api/v1 path';
        }
        return null;
      },
    });

    if (host === undefined) {
      return; // User cancelled
    }

    await Settings.setHost(host);
    vscode.window.showInformationMessage(`✓ Host saved: ${host}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to save host: ${errorMsg}`);
    console.error('Host setting error:', error);
  }
}
