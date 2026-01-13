/**
 * Clone Repository from Gitea
 * Gitea Remote Repositories v1.0.4
 * Clone Gitea repos to local machine
 */
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { GiteaClient } from '../giteaApi/client';
import { Repository } from '../models/repository';
import { GiteaRemoteManager } from '../utils/giteaRemoteManager';
import { LocalRepoManager } from '../utils/localRepoManager';
import { Settings } from '../config/settings';

export async function handleCloneRepository(client: GiteaClient, server: string = 'unknown'): Promise<void> {
  try {
    // Get list of repositories
    const repos = await client.getUserRepositories();

    if (repos.length === 0) {
      vscode.window.showInformationMessage('No repositories available on this Gitea server');
      return;
    }

    // Create quick pick items
    const items: vscode.QuickPickItem[] = repos.map((repo) => ({
      label: `$(repo) ${repo.owner.login}/${repo.name}`,
      description: repo.description || '(no description)',
      detail: repo.clone_url,
    }));

    // Show quick pick dialog
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a repository to clone',
      matchOnDescription: true,
    });

    if (!selected) return;

    // Extract clone URL and repo info
    const cloneUrl = selected.detail!;
    const [owner, repoName] = selected.label.split('/').slice(-2);

    // Ask user how to clone
    const cloneMethod = await vscode.window.showQuickPick(
      [
        {
          label: '$(cloud) Virtual Filesystem (gitea://)',
          description: 'Browse files without local clone',
          detail: 'Fast, no local storage needed',
        },
        {
          label: '$(folder) Local Clone',
          description: 'Clone to local directory',
          detail: 'Full git repo with sync capabilities',
        },
      ],
      { placeHolder: 'How would you like to access this repository?' }
    );

    if (!cloneMethod) return;

    if (cloneMethod.label.includes('Virtual')) {
      // Use virtual filesystem (existing logic)
      await cloneToVirtualFS(cloneUrl, owner, repoName);
    } else {
      // Clone to local filesystem
      if (!Settings.isLocalCloneEnabled()) {
        vscode.window.showWarningMessage(
          'Local cloning is disabled in settings. Enable it in g2r.localClone.enabled'
        );
        return;
      }
      await cloneToLocal(cloneUrl, owner, repoName, server);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to clone repository: ${msg}`);
  }
}

async function cloneToVirtualFS(
  cloneUrl: string,
  owner: string,
  repoName: string
): Promise<void> {
  try {
    const uri = vscode.Uri.parse(
      `gitea://${owner}/${repoName}/`
    );
    vscode.window.showInformationMessage(
      `Virtual access created: ${uri.toString()}`
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to create virtual access: ${msg}`);
  }
}

async function cloneToLocal(
  cloneUrl: string,
  owner: string,
  repoName: string,
  server: string
): Promise<void> {
  try {
    // Get target directory
    const defaultPath = Settings.getLocalClonePath();
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: 'Select folder to clone into',
      defaultUri: vscode.Uri.file(defaultPath),
    });

    if (!folders || folders.length === 0) return;

    const targetDir = folders[0].fsPath;
    const repoDir = path.join(targetDir, repoName);

    // Check if folder already exists
    if (fs.existsSync(repoDir)) {
      const choice = await vscode.window.showWarningMessage(
        `Folder "${repoName}" already exists in "${targetDir}"`,
        'Cancel',
        'New folder',
        'Overwrite'
      );

      if (!choice || choice === 'Cancel') return;

      if (choice === 'New folder') {
        const folderName = await vscode.window.showInputBox({
          prompt: 'Enter a new folder name',
          value: `${repoName}-clone`,
          validateInput: (input) => {
            if (!input) return 'Folder name cannot be empty';
            if (fs.existsSync(path.join(targetDir, input))) {
              return 'Folder already exists';
            }
            return null;
          },
        });

        if (!folderName) return;
        await performLocalClone(cloneUrl, path.join(targetDir, folderName), owner, repoName, false, server);
      } else {
        await performLocalClone(cloneUrl, repoDir, owner, repoName, true, server);
      }
    } else {
      await performLocalClone(cloneUrl, repoDir, owner, repoName, false, server);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Clone to local failed: ${msg}`);
  }
}

async function performLocalClone(
  cloneUrl: string,
  targetDir: string,
  owner: string,
  repoName: string,
  removeExisting: boolean = false,
  server: string = 'unknown'
): Promise<void> {
  return new Promise((resolve, reject) => {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Cloning ${repoName}...`,
        cancellable: true,
      },
      async (progress, token) => {
        try {
          // Remove existing if requested
          if (removeExisting && fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }

          // Create parent directory if needed
          const parentDir = path.dirname(targetDir);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          // Execute git clone
          return new Promise<void>((gitResolve, gitReject) => {
            const clone = cp.spawn('git', ['clone', cloneUrl, targetDir], {
              cwd: path.dirname(targetDir),
            });

            let output = '';
            let errorOutput = '';

            clone.stdout?.on('data', (data) => {
              output += data.toString();
              progress.report({ increment: 5, message: 'Cloning...' });
            });

            clone.stderr?.on('data', (data) => {
              errorOutput += data.toString();
            });

            clone.on('close', (code) => {
              if (code === 0) {
                vscode.window.showInformationMessage(
                  `✓ Repository "${owner}/${repoName}" cloned to ${targetDir}`,
                  'Open Folder',
                  'Open in New Window'
                ).then((choice) => {
                  if (choice === 'Open Folder' || choice === 'Open in New Window') {
                    vscode.commands.executeCommand(
                      'vscode.openFolder',
                      vscode.Uri.file(targetDir),
                      choice === 'Open in New Window'
                    );
                  }
                });
                gitResolve();
              } else {
                gitReject(
                  new Error(
                    errorOutput || `Git clone failed with code ${code}`
                  )
                );
              }
            });

            clone.on('error', (err) => {
              gitReject(err);
            });

            token.onCancellationRequested(() => {
              clone.kill();
              gitReject(new Error('Clone cancelled'));
            });
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

async function performClone(
  cloneUrl: string,
  targetDir: string,
  repoName: string,
  removeExisting: boolean = false,
  server: string = 'unknown'
): Promise<void> {
  return new Promise((resolve, reject) => {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Cloning ${repoName}...`,
        cancellable: true,
      },
      async (progress, token) => {
        try {
          // Remove existing if requested
          if (removeExisting && fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }

          // Create parent directory if needed
          const parentDir = path.dirname(targetDir);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          // Execute git clone
          return new Promise<void>((gitResolve, gitReject) => {
            const clone = cp.spawn('git', ['clone', cloneUrl, targetDir], {
              cwd: path.dirname(targetDir),
            });

            let output = '';
            let errorOutput = '';

            clone.stdout?.on('data', (data) => {
              output += data.toString();
              progress.report({ increment: 5, message: 'Cloning...' });
            });

            clone.stderr?.on('data', (data) => {
              errorOutput += data.toString();
            });

            clone.on('close', (code) => {
              if (code === 0) {
                vscode.window.showInformationMessage(
                  `Repository cloned to ${targetDir}`,
                  'Open Folder',
                  'Open in New Window'
                ).then((choice) => {
                  if (choice === 'Open Folder') {
                    // Save metadata before opening folder
                    GiteaRemoteManager.saveMetadata(targetDir, {
                      server: server,
                      owner: repoName.split('/')[0],
                      repo: repoName,
                      branch: 'master',
                      timestamp: Date.now(),
                    });

                    vscode.commands.executeCommand(
                      'vscode.openFolder',
                      vscode.Uri.file(targetDir),
                      false
                    );
                  } else if (choice === 'Open in New Window') {
                    // Save metadata before opening folder
                    GiteaRemoteManager.saveMetadata(targetDir, {
                      server: server,
                      owner: repoName.split('/')[0],
                      repo: repoName,
                      branch: 'master',
                      timestamp: Date.now(),
                    });

                    vscode.commands.executeCommand(
                      'vscode.openFolder',
                      vscode.Uri.file(targetDir),
                      true
                    );
                  }
                });
                gitResolve();
              } else {
                gitReject(
                  new Error(
                    errorOutput || `Git clone failed with code ${code}`
                  )
                );
              }
            });

            clone.on('error', (err) => {
              gitReject(err);
            });

            token.onCancellationRequested(() => {
              clone.kill();
              gitReject(new Error('Clone cancelled'));
            });
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}
