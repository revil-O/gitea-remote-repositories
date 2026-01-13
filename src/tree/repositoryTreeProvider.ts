/**
 * Repository TreeView Provider
 * Gitea Remote Repositories v1.0.4
 * Shows all repositories accessible via Gitea + Local cloned repos
 */
import * as vscode from 'vscode';
import { GiteaClient } from '../giteaApi/client';
import { AuthManager } from '../auth/authManager';
import { LocalRepoManager, SyncStatus } from '../utils/localRepoManager';
import { Settings } from '../config/settings';

export class RepositoryTreeProvider implements vscode.TreeDataProvider<RepositoryTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<RepositoryTreeItem | undefined | null | void> =
    new vscode.EventEmitter<RepositoryTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<RepositoryTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private authManager: AuthManager;
  private currentServer: string | null = null;
  private client: GiteaClient | null = null;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setServer(server: string, client: GiteaClient): void {
    this.currentServer = server;
    this.client = client;
    this.refresh();
  }

  async getTreeItem(element: RepositoryTreeItem): Promise<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: RepositoryTreeItem): Promise<RepositoryTreeItem[]> {
    try {
      if (!this.client || !this.currentServer) {
        return [
          new RepositoryTreeItem(
            'No server connected',
            vscode.TreeItemCollapsibleState.None,
            'info'
          ),
        ];
      }

      if (!element) {
        // Root: Show sections for Remote and Local repositories
        const items: RepositoryTreeItem[] = [];

        // Remote repositories section
        items.push(
          new RepositoryTreeItem(
            'Remote Repositories',
            vscode.TreeItemCollapsibleState.Expanded,
            'cloud',
            undefined,
            `On ${this.currentServer}`,
            'remote'
          )
        );

        // Local repositories section (if enabled)
        if (Settings.isLocalCloneEnabled()) {
          items.push(
            new RepositoryTreeItem(
              'Local Repositories',
              vscode.TreeItemCollapsibleState.Expanded,
              'folder-active',
              undefined,
              Settings.getLocalClonePath(),
              'local'
            )
          );
        }

        return items;
      }

      // Remote section
      if (element.contextValue === 'remote') {
        const repos = await this.client.getUserRepositories();
        return repos.map(
          (repo) =>
            new RepositoryTreeItem(
              `${repo.owner.login}/${repo.name}`,
              vscode.TreeItemCollapsibleState.Collapsed,
              repo.private ? 'lock' : 'repo',
              {
                command: 'gitea.openRepository',
                title: 'Open Repository',
                arguments: [this.currentServer, repo.owner.login, repo.name],
              },
              repo.description || '',
              'remoteRepo'
            )
        );
      }

      // Local section
      if (element.contextValue === 'local') {
        const repos = await LocalRepoManager.getLocalRepositories();
        const items: RepositoryTreeItem[] = [];

        for (const repo of repos) {
          const status = await LocalRepoManager.getSyncStatus(repo.path);
          const statusIcon = this.getSyncStatusIcon(status);
          const statusLabel = this.getSyncStatusLabel(status);

          items.push(
            new RepositoryTreeItem(
              `${repo.owner}/${repo.name}${statusLabel}`,
              vscode.TreeItemCollapsibleState.None,
              statusIcon,
              {
                command: 'gitea.openLocalRepository',
                title: 'Open Local Repository',
                arguments: [repo.path],
              },
              `${repo.path}\n${statusLabel}`,
              'localRepo'
            )
          );
        }

        return items.length > 0
          ? items
          : [
              new RepositoryTreeItem(
                'No local repositories found',
                vscode.TreeItemCollapsibleState.None,
                'info'
              ),
            ];
      }

      return [];
    } catch (error) {
      console.error('Error getting repositories:', error);
      return [
        new RepositoryTreeItem(
          'Error loading repositories',
          vscode.TreeItemCollapsibleState.None,
          'error'
        ),
      ];
    }
  }

  private getSyncStatusIcon(status: SyncStatus): string {
    if (status.isDirty && status.ahead > 0) {
      return 'cloud-upload'; // Has local changes to push
    } else if (status.behind > 0) {
      return 'cloud-download'; // Has remote changes to pull
    } else if (status.isDirty) {
      return 'git-commit'; // Uncommitted changes
    }
    return 'check'; // Up to date
  }

  private getSyncStatusLabel(status: SyncStatus): string {
    const parts: string[] = [];
    if (status.ahead > 0) parts.push(`↑${status.ahead}`);
    if (status.behind > 0) parts.push(`↓${status.behind}`);
    if (status.untracked.length > 0) parts.push(`+${status.untracked.length}`);

    return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
  }
}

export class RepositoryTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    icon: string,
    command?: vscode.Command,
    tooltip?: string,
    public contextValue?: string
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip;
    this.command = command;
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}
