/**
 * Sync/Pull functionality for Gitea repositories
 * Gitea Remote Repositories v1.0.4
 * Sync files from Gitea to local folder + bidirectional git sync
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GiteaClient } from '../giteaApi/client';
import { GiteaRemoteManager } from '../utils/giteaRemoteManager';
import { LocalRepoManager, SyncStatus } from '../utils/localRepoManager';
import { Settings } from '../config/settings';

export async function handleSyncRepository(
  owner: string,
  repo: string,
  client: GiteaClient,
  branch: string = 'master',
  server: string = 'unknown'
): Promise<void> {
  try {
    // Check if this is a local git repo
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let isLocalGit = false;

    if (workspaceFolders && workspaceFolders.length > 0) {
      const repoPath = workspaceFolders[0].uri.fsPath;
      if (fs.existsSync(path.join(repoPath, '.git'))) {
        isLocalGit = true;

        // Offer bidirectional sync for git repos
        const syncType = await vscode.window.showQuickPick(
          [
            {
              label: '$(cloud-download) Pull from Gitea',
              description: 'Fetch latest changes from remote',
            },
            {
              label: '$(cloud-upload) Push to Gitea',
              description: 'Sync local changes to remote',
            },
            {
              label: '$(sync) Two-way Sync',
              description: 'Pull then push changes',
            },
          ],
          { placeHolder: 'Select sync direction' }
        );

        if (!syncType) return;

        if (syncType.label.includes('Pull')) {
          await LocalRepoManager.syncFromGitea(repoPath, branch);
        } else if (syncType.label.includes('Push')) {
          await LocalRepoManager.syncToGitea(repoPath, branch);
        } else {
          // Two-way sync
          await LocalRepoManager.syncFromGitea(repoPath, branch);
          await LocalRepoManager.syncToGitea(repoPath, branch);
        }
        return;
      }
    }

    // Fallback: Virtual filesystem sync (existing logic)
    // Ask where to sync to
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: `Select folder to sync ${owner}/${repo} to`,
      defaultUri: vscode.Uri.file(
        path.join(
          Settings.getLocalClonePath(),
          repo
        )
      ),
    });

    if (!folders || folders.length === 0) return;

    const targetDir = folders[0].fsPath;

    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Syncing ${owner}/${repo}...`,
        cancellable: false,
      },
      async (progress) => {
        await syncDirectory(
          client,
          owner,
          repo,
          '',
          targetDir,
          branch,
          progress
        );
      }
    );

    vscode.window.showInformationMessage(
      `✓ Synced ${owner}/${repo} to ${targetDir}`,
      'Open Folder'
    ).then((choice) => {
      if (choice === 'Open Folder') {
        // Save metadata before opening folder
        GiteaRemoteManager.saveMetadata(targetDir, {
          server: server,
          owner,
          repo,
          branch: 'master',
          timestamp: Date.now(),
        });

        vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(targetDir),
          false
        );
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to sync repository: ${msg}`);
  }
}

/**
 * Get sync status of local repositories
 */
export async function getLocalRepositorySyncStatus(): Promise<Map<string, SyncStatus>> {
  const statusMap = new Map<string, SyncStatus>();

  try {
    const repos = await LocalRepoManager.getLocalRepositories();

    for (const repo of repos) {
      const status = await LocalRepoManager.getSyncStatus(repo.path);
      statusMap.set(repo.path, status);
    }
  } catch (error) {
    console.error('Error getting sync status:', error);
  }

  return statusMap;
}

async function syncDirectory(
  client: GiteaClient,
  owner: string,
  repo: string,
  remotePath: string,
  localPath: string,
  branch: string,
  progress: vscode.Progress<{ increment?: number; message?: string }>
): Promise<void> {
  try {
    // Get contents of remote directory
    const entries = await client.getRepositoryContents(owner, repo, remotePath, branch);

    for (const entry of entries) {
      const localEntryPath = path.join(localPath, entry.name);

      if (entry.type === 'dir') {
        // Create local directory
        if (!fs.existsSync(localEntryPath)) {
          fs.mkdirSync(localEntryPath, { recursive: true });
        }

        // Recursively sync subdirectory
        await syncDirectory(
          client,
          owner,
          repo,
          entry.path,
          localEntryPath,
          branch,
          progress
        );
      } else {
        // Download file
        if (entry.download_url) {
          try {
            const response = await fetch(entry.download_url);
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              fs.writeFileSync(localEntryPath, Buffer.from(buffer));
              progress.report({ message: `Synced ${entry.path}` });
            }
          } catch (err) {
            console.error(`Failed to download ${entry.path}:`, err);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error syncing directory:', error);
  }
}
