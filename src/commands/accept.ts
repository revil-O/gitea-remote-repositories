/**
 * Accept/Merge Pull Request Command Handler
 */
import * as vscode from 'vscode';
import { GiteaClient } from '../giteaApi/client';
import { PullRequest } from '../models/pullRequest';
import { Settings } from '../config/settings';

export async function handleAcceptPullRequest(pullRequest: PullRequest): Promise<void> {
  try {
    if (!Settings.isConfigured()) {
      vscode.window.showErrorMessage('Gitea settings not configured. Please set token and host.');
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Merge pull request #${pullRequest.number}?`,
      { modal: true },
      'Yes',
      'No'
    );

    if (confirmed !== 'Yes') {
      return;
    }

    const client = new GiteaClient();

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Merging PR #${pullRequest.number}...`,
        cancellable: false,
      },
      async () => {
        // Select merge method
        const mergeMethod = await vscode.window.showQuickPick(
          ['merge', 'squash', 'rebase'],
          { placeHolder: 'Select merge method' }
        );

        if (!mergeMethod) {
          return;
        }

        const [owner, repo] = pullRequest.base.repo.full_name.split('/');
        await client.mergePullRequest(
          owner,
          repo,
          pullRequest.number,
          mergeMethod as 'merge' | 'squash' | 'rebase'
        );

        vscode.window.showInformationMessage(`✓ PR #${pullRequest.number} merged successfully!`);
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to merge PR: ${errorMsg}`);
    console.error('Accept PR error:', error);
  }
}
