/**
 * Diff/Review Pull Request Files Command Handler
 */
import * as vscode from 'vscode';
import { GiteaClient } from '../giteaApi/client';
import { PullRequest, PullRequestFile } from '../models/pullRequest';
import { Settings } from '../config/settings';

export async function handleDiffPullRequest(pullRequest: PullRequest): Promise<void> {
  try {
    if (!Settings.isConfigured()) {
      vscode.window.showErrorMessage('Gitea settings not configured. Please set token and host.');
      return;
    }

    const client = new GiteaClient();

    const files = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Loading PR #${pullRequest.number} files...`,
      },
      async () => {
        const [owner, repo] = pullRequest.base.repo.full_name.split('/');
        return client.getPullRequestFiles(owner, repo, pullRequest.number);
      }
    );

    if (!files || files.length === 0) {
      vscode.window.showInformationMessage('No files changed in this PR.');
      return;
    }

    // Create a quick pick menu for file selection
    const selectedFile = await vscode.window.showQuickPick(
      files.map((file) => ({
        label: file.filename,
        description: `+${file.additions} -${file.deletions}`,
        file,
      })),
      { placeHolder: 'Select a file to view diff' }
    );

    if (!selectedFile) {
      return;
    }

    await showFileDiff(selectedFile.file, pullRequest);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to load PR files: ${errorMsg}`);
    console.error('Diff PR error:', error);
  }
}

async function showFileDiff(file: PullRequestFile, pullRequest: PullRequest): Promise<void> {
  try {
    // Create a virtual document for the diff
    const uri = vscode.Uri.parse(
      `gitea-diff:///${pullRequest.number}/${file.filename}`
    );

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

    // Alternatively, show diff content in output channel
    const outputChannel = vscode.window.createOutputChannel(`PR #${pullRequest.number} - ${file.filename}`);
    
    let content = `File: ${file.filename}\n`;
    content += `Status: ${file.status}\n`;
    content += `Changes: +${file.additions} -${file.deletions}\n`;
    content += `\n--- Patch ---\n`;
    content += file.patch || '(Binary file or no patch available)';

    outputChannel.append(content);
    outputChannel.show(true);
  } catch (error) {
    console.error('Show diff error:', error);
    vscode.window.showErrorMessage('Failed to show file diff');
  }
}
