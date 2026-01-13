/**
 * Local Repository Manager
 * Gitea Remote Repositories v1.0.4
 * Manages local clone, pull, push operations
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { promisify } from 'util';
import { Settings } from '../config/settings';

const exec = promisify(cp.exec);
const execFile = promisify(cp.execFile);

export interface LocalRepositoryConfig {
  path: string;
  cloneUrl: string;
  owner: string;
  name: string;
}

export interface SyncStatus {
  isDirty: boolean;
  ahead: number;
  behind: number;
  untracked: string[];
}

export class LocalRepoManager {
  /**
   * Clone a repository to local filesystem
   */
  static async cloneRepository(
    cloneUrl: string,
    targetPath: string,
    owner: string,
    repoName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const cloneProcess = cp.spawn('git', ['clone', cloneUrl, targetPath], {
        stdio: 'pipe',
      });

      let output = '';
      let error = '';

      cloneProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      cloneProcess.stderr?.on('data', (data) => {
        error += data.toString();
      });

      cloneProcess.on('close', (code) => {
        if (code === 0) {
          vscode.window.showInformationMessage(
            `✓ Repository "${owner}/${repoName}" cloned successfully to "${targetPath}"`
          );
          resolve();
        } else {
          reject(new Error(`Clone failed: ${error || output}`));
        }
      });

      cloneProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Get sync status of a local repository
   */
  static async getSyncStatus(repoPath: string): Promise<SyncStatus> {
    try {
      // Check if git repo exists
      if (!fs.existsSync(path.join(repoPath, '.git'))) {
        return {
          isDirty: false,
          ahead: 0,
          behind: 0,
          untracked: [],
        };
      }

      // Get status
      const { stdout: statusOutput } = await exec(
        'git status --porcelain',
        { cwd: repoPath }
      );

      const untracked = statusOutput
        .split('\n')
        .filter((line) => line.startsWith('??'))
        .map((line) => line.substring(3));

      const isDirty =
        statusOutput.length > 0 &&
        !untracked.every((line) => line.length === 0);

      // Get ahead/behind counts
      let ahead = 0;
      let behind = 0;

      try {
        const { stdout: aheadOutput } = await exec(
          'git rev-list --left-only --count @{u}...HEAD',
          { cwd: repoPath }
        );
        ahead = parseInt(aheadOutput.trim(), 10) || 0;

        const { stdout: behindOutput } = await exec(
          'git rev-list --right-only --count @{u}...HEAD',
          { cwd: repoPath }
        );
        behind = parseInt(behindOutput.trim(), 10) || 0;
      } catch {
        // Tracking branch might not exist, default to 0
      }

      return { isDirty, ahead, behind, untracked };
    } catch (error) {
      vscode.window.showErrorMessage(`Error getting sync status: ${error}`);
      return {
        isDirty: false,
        ahead: 0,
        behind: 0,
        untracked: [],
      };
    }
  }

  /**
   * Sync local changes to Gitea (push)
   */
  static async syncToGitea(
    repoPath: string,
    branch: string = 'main'
  ): Promise<void> {
    try {
      // Stage all changes
      await exec('git add -A', { cwd: repoPath });

      // Check if there are changes to commit
      const { stdout: statusOutput } = await exec(
        'git status --porcelain',
        { cwd: repoPath }
      );

      if (statusOutput.trim().length === 0) {
        vscode.window.showInformationMessage('✓ No changes to sync');
        return;
      }

      // Get commit message
      const message = await vscode.window.showInputBox({
        prompt: 'Enter commit message for sync',
        value: '[auto-sync] Updated from local',
      });

      if (!message) return;

      // Commit
      await exec(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: repoPath,
      });

      // Push
      await exec(`git push origin ${branch}`, { cwd: repoPath });

      vscode.window.showInformationMessage('✓ Changes synced to Gitea');
    } catch (error) {
      vscode.window.showErrorMessage(`Sync failed: ${error}`);
    }
  }

  /**
   * Pull latest changes from Gitea
   */
  static async syncFromGitea(
    repoPath: string,
    branch: string = 'main'
  ): Promise<void> {
    try {
      const { stdout: output } = await exec(
        `git pull origin ${branch}`,
        { cwd: repoPath }
      );

      vscode.window.showInformationMessage(`✓ Pulled latest changes:\n${output}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Pull failed: ${error}`);
    }
  }

  /**
   * Get list of local repositories from default path
   */
  static async getLocalRepositories(): Promise<LocalRepositoryConfig[]> {
    const basePath = Settings.getLocalClonePath();
    const repos: LocalRepositoryConfig[] = [];

    if (!fs.existsSync(basePath)) {
      return repos;
    }

    try {
      const directories = fs.readdirSync(basePath);

      for (const dir of directories) {
        const repoPath = path.join(basePath, dir);
        const stat = fs.statSync(repoPath);

        if (stat.isDirectory() && fs.existsSync(path.join(repoPath, '.git'))) {
          try {
            const { stdout: url } = await exec(
              'git config --get remote.origin.url',
              { cwd: repoPath }
            );

            const cleanUrl = url.trim();
            const match = cleanUrl.match(/\/([^/]+)\/([^/]+?)(\.git)?$/);

            if (match) {
              repos.push({
                path: repoPath,
                cloneUrl: cleanUrl,
                owner: match[1],
                name: match[2],
              });
            }
          } catch {
            // Skip if not a valid git repo
          }
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error reading local repositories: ${error}`);
    }

    return repos;
  }

  /**
   * Remove local repository
   */
  static async removeLocalRepository(repoPath: string): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Delete repository at "${repoPath}"?`,
      'Cancel',
      'Delete'
    );

    if (confirm !== 'Delete') return;

    try {
      fs.rmSync(repoPath, { recursive: true, force: true });
      vscode.window.showInformationMessage(
        `✓ Repository deleted from "${repoPath}"`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete repository: ${error}`);
    }
  }

  /**
   * Open local repository in VS Code
   */
  static async openLocalRepository(repoPath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(repoPath);
      await vscode.commands.executeCommand('vscode.openFolder', uri, false);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open repository: ${error}`);
    }
  }
}
