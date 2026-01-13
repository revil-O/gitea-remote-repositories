/**
 * Reject/Close Pull Request Command Handler
 */
import * as vscode from 'vscode';
import { GiteaClient } from '../giteaApi/client';
import { PullRequest } from '../models/pullRequest';
import { Settings } from '../config/settings';

export async function handleRejectPullRequest(pullRequest: PullRequest): Promise<void> {
  try {
    if (!Settings.isConfigured()) {
      vscode.window.showErrorMessage('Gitea settings not configured. Please set token and host.');
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Close pull request #${pullRequest.number}?`,
      { modal: true },
      'Yes',
      'No'
    );

    if (confirmed !== 'Yes') {
      return;
    }

    const client = new GiteaClient();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Closing PR #${pullRequest.number}...`,
        cancellable: false,
      },
      async () => {
        const [owner, repo] = pullRequest.base.repo.full_name.split('/');
        await client.closePullRequest(owner, repo, pullRequest.number);

        vscode.window.showInformationMessage(`✓ PR #${pullRequest.number} closed successfully!`);
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to close PR: ${errorMsg}`);
    console.error('Reject PR error:', error);
  }
}
