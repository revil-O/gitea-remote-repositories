/**
 * Gitea Remote Repositories - Main Extension (v1.0.4)
 * Publisher: revilo - Oliver Schmidt
 * 
 * This extension provides:
 * - Virtual FileSystem for gitea:// URIs
 * - Remote repository browsing without local clone
 * - Pull Request, Issue, and Branch management
 * - File viewing and editing
 */

import * as vscode from 'vscode';
import { RepositoryTreeProvider } from './tree/repositoryTreeProvider';
import { BranchTreeProvider } from './tree/branchTreeProvider';
import { IssueTreeProvider } from './tree/issueTreeProvider';
import { GiteaFileSystemProvider } from './fs/giteaFileSystemProvider';
import { AuthManager } from './auth/authManager';
import { GiteaClient } from './giteaApi/client';
import { LocalRepoManager } from './utils/localRepoManager';

// Command handlers
import { handleAcceptPullRequest } from './commands/accept';
import { handleRejectPullRequest } from './commands/reject';
import { handleRefreshPullRequests } from './commands/refresh';
import { handleDiffPullRequest } from './commands/diff';
import { handleActivePullRequest } from './commands/active';
import { handleSettingToken, handleSettingHost } from './commands/settings';
import {
  handleConnect,
  handleOpenRepository,
  handleOpenFile,
  handleCloneToLocal,
  handleSearchRepositories,
} from './commands/remoteRepo';
import { handleCloneRepository } from './commands/clone';
import { handleSyncRepository } from './commands/sync';
import { FileTreeProvider } from './tree/fileTreeProvider';
import { GiteaRemoteManager } from './utils/giteaRemoteManager';

import { Settings } from './config/settings';
import { PullRequest } from './models/pullRequest';
import { registerShowChangelogCommand } from './commands/showChangelog';

let repositoryTreeProvider: RepositoryTreeProvider;
let branchTreeProvider: BranchTreeProvider;
let issueTreeProvider: IssueTreeProvider;
let authManager: AuthManager;
let fsProvider: GiteaFileSystemProvider;
let refreshTimer: NodeJS.Timer | null = null;
let currentServer: string | null = null;
let currentClient: GiteaClient | null = null;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Gitea Remote Repositories Extension is now active');

  // Initialize auth manager
  authManager = new AuthManager(context.secrets);

  // Initialize file system provider
  fsProvider = new GiteaFileSystemProvider(authManager);

  // Register virtual FileSystem provider for gitea:// URIs
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('gitea', fsProvider, {
      isCaseSensitive: true,
      isReadonly: true,
    })
  );

  // Initialize tree data providers
  repositoryTreeProvider = new RepositoryTreeProvider(authManager);
  branchTreeProvider = new BranchTreeProvider();
  issueTreeProvider = new IssueTreeProvider();
  const fileTreeProvider = new FileTreeProvider();

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('giteaRepositories', repositoryTreeProvider)
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('giteaBranches', branchTreeProvider)
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('giteaIssues', issueTreeProvider)
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('giteaFiles', fileTreeProvider)
  );

  // Create status bar BEFORE auto-connect so we can update it
  createStatusBar();

  // Auto-connect if configured
  if (Settings.getAutoConnect() && Settings.isConfigured()) {
    console.log('Auto-connecting to Gitea...');
    const result = await handleConnect(authManager, context);
    if (result) {
      currentServer = result.server;
      currentClient = result.client;
      repositoryTreeProvider.setServer(result.server, result.client);
      branchTreeProvider.setRepository('', '', result.client);
      updateStatusBar(); // Update status bar after connection
    }
  } else {
    // Check if current folder is a Gitea remote
    const metadata = GiteaRemoteManager.getCurrentFolderMetadata();
    if (metadata) {
      console.log(`[Gitea] Detected Gitea remote: ${metadata.owner}/${metadata.repo}`);
      // Show repo info in status bar
      if (statusBarItem) {
        statusBarItem.text = `$(repo) Gitea: ${metadata.owner}/${metadata.repo} (detected)`;
        statusBarItem.tooltip = `Detected repository from ${metadata.server}. Click to connect.`;
        statusBarItem.command = 'gitea.connect';
        statusBarItem.show();
      }
      // Show notification
      vscode.window.showInformationMessage(
        `📂 Gitea repository detected: ${metadata.owner}/${metadata.repo}`,
        'Connect'
      ).then((choice) => {
        if (choice === 'Connect') {
          vscode.commands.executeCommand('gitea.connect');
        }
      });
    }
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'g2r.setting:token',
      handleSettingToken
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'g2r.setting:host',
      handleSettingHost
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'g2r.action:accept',
      (pr: PullRequest) => handleAcceptPullRequest(pr)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'g2r.action:reject',
      (pr: PullRequest) => handleRejectPullRequest(pr)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'g2r.action:refresh',
      () => handleRefreshPullRequests()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'g2r.action:diff',
      (pr: PullRequest) => handleDiffPullRequest(pr)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'g2r.action:active',
      (pr: PullRequest) => handleActivePullRequest(pr)
    )
  );

  // ============================================
  // NEW COMMANDS (Remote Repositories)
  // ============================================

  context.subscriptions.push(
    vscode.commands.registerCommand('gitea.connect', async () => {
      const result = await handleConnect(authManager, context);
      if (result) {
        currentServer = result.server;
        currentClient = result.client;
        repositoryTreeProvider.setServer(result.server, result.client);
        branchTreeProvider.setRepository('', '', result.client);
        updateStatusBar();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'gitea.openRepository',
      async (server: string, owner: string, repo: string) => {
        if (currentClient) {
          await handleOpenRepository(server, owner, repo, currentClient);
          // Update branches and issues views for selected repo
          branchTreeProvider.setRepository(owner, repo, currentClient);
          issueTreeProvider.setRepository(owner, repo, currentClient);
          fileTreeProvider.setRepository(owner, repo, 'master', currentClient);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitea.syncRepository', async (owner?: string, repo?: string) => {
      if (!currentClient) {
        vscode.window.showWarningMessage('Please connect to a Gitea server first');
        return;
      }

      // If not called with params, use current selection (TODO: implement proper repo selection)
      if (!owner || !repo) {
        vscode.window.showWarningMessage('Please select a repository first');
        return;
      }

      await handleSyncRepository(owner, repo, currentClient, 'master', currentServer || 'unknown');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitea.openFile', handleOpenFile)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'gitea.cloneToLocal',
      (server: string, owner: string, repo: string) => {
        if (currentClient) {
          handleCloneToLocal(server, owner, repo, currentClient);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitea.searchRepositories', () => {
      if (currentClient) {
        handleSearchRepositories(currentClient);
      } else {
        vscode.window.showWarningMessage('Please connect to a Gitea server first');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitea.cloneRepository', async () => {
      if (currentClient) {
        await handleCloneRepository(currentClient, currentServer || 'unknown');
      } else {
        vscode.window.showWarningMessage('Please connect to a Gitea server first');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitea.disconnect', async () => {
      if (currentServer) {
        await authManager.deleteToken(currentServer);
        currentServer = null;
        currentClient = null;
        repositoryTreeProvider.setServer('', new GiteaClient());
        fsProvider.clearServerCache(currentServer || '');
        updateStatusBar();
        vscode.window.showInformationMessage('Disconnected from Gitea');
      }
    })
  );

  // Local repository commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gitea.openLocalRepository', async (repoPath: string) => {
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(repoPath), false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitea.syncLocalRepository', async (repoPath: string) => {
      const status = await LocalRepoManager.getSyncStatus(repoPath);
      const choice = await vscode.window.showQuickPick(
        [
          { label: '$(cloud-download) Pull', description: 'Fetch from remote' },
          { label: '$(cloud-upload) Push', description: 'Push to remote' },
          { label: '$(sync) Both', description: 'Pull then push' },
        ],
        { placeHolder: 'Select sync direction' }
      );

      if (!choice) return;

      if (choice.label.includes('Pull')) {
        await LocalRepoManager.syncFromGitea(repoPath, 'main');
      } else if (choice.label.includes('Push')) {
        await LocalRepoManager.syncToGitea(repoPath, 'main');
      } else {
        await LocalRepoManager.syncFromGitea(repoPath, 'main');
        await LocalRepoManager.syncToGitea(repoPath, 'main');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitea.removeLocalRepository', async (repoPath: string) => {
      await LocalRepoManager.removeLocalRepository(repoPath);
      repositoryTreeProvider.refresh();
    })
  );

  // Register changelog webview command
  registerShowChangelogCommand(context);

  // Setup context for conditional UI
  updateSettingContext();

  // Watch configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('g2r')) {
        updateSettingContext();
      }
    })
  );

  // Setup auto-refresh timer (every 5 minutes)
  startAutoRefresh(context);

  // Setup auto-refresh timer (every 5 minutes)
  startAutoRefresh(context);
}

function startAutoRefresh(context: vscode.ExtensionContext): void {
  // Refresh every 5 minutes (300000 ms)
  refreshTimer = setInterval(() => {
    if (Settings.isConfigured()) {
      // Refresh happens automatically through watchers
    }
  }, 5 * 60 * 1000);

  // Clear timer on deactivation
  context.subscriptions.push(
    new vscode.Disposable(() => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    })
  );
}

export function deactivate(): void {
  console.log('Gitea Remote Repositories Extension is now deactivated');

  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
}

function updateSettingContext(): void {
  const settingState = Settings.getSettingState();
  vscode.commands.executeCommand('setContext', 'SETTING_STATE', settingState);
}

function createStatusBar(): void {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = '$(server) Gitea: Not Connected';
  statusBarItem.command = 'gitea.connect';
  statusBarItem.tooltip = 'Click to connect to Gitea';
  statusBarItem.show();
}

function updateStatusBar(): void {
  if (currentServer) {
    statusBarItem.text = `$(server) Gitea: ${currentServer}`;
    statusBarItem.tooltip = `Connected to ${currentServer}`;
    vscode.commands.executeCommand('setContext', 'gitea.connected', true);
  } else {
    statusBarItem.text = '$(server) Gitea: Not Connected';
    statusBarItem.tooltip = 'Click to connect to Gitea';
    vscode.commands.executeCommand('setContext', 'gitea.connected', false);
  }
}
