/**
 * Branch TreeView Provider
 * Gitea Remote Repositories v1.0.4
 * Shows all branches in a repository
 */
import * as vscode from 'vscode';
import { GiteaClient } from '../giteaApi/client';

export class BranchTreeProvider implements vscode.TreeDataProvider<BranchTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<BranchTreeItem | undefined | null | void> =
    new vscode.EventEmitter<BranchTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<BranchTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private client: GiteaClient | null = null;
  private owner = '';
  private repo = '';

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setRepository(owner: string, repo: string, client: GiteaClient): void {
    this.owner = owner;
    this.repo = repo;
    this.client = client;
    this.refresh();
  }

  async getTreeItem(element: BranchTreeItem): Promise<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: BranchTreeItem): Promise<BranchTreeItem[]> {
    try {
      if (!this.client || !this.owner || !this.repo) {
        return [];
      }

      if (!element) {
        const branches = await this.client.getBranches(this.owner, this.repo);
        return branches.map(
          (branch) =>
            new BranchTreeItem(
              branch.name,
              vscode.TreeItemCollapsibleState.None,
              branch.commit.sha.substring(0, 7),
              branch.protected
            )
        );
      }

      return [];
    } catch (error) {
      console.error('Error getting branches:', error);
      return [];
    }
  }
}

export class BranchTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    sha: string,
    protected_ = false
  ) {
    super(label, collapsibleState);
    this.description = sha;
    this.iconPath = protected_ ? new vscode.ThemeIcon('lock') : new vscode.ThemeIcon('git-branch');
    this.tooltip = `${label} (${sha})`;
  }
}
