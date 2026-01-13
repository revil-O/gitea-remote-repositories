/**
 * Issues TreeView Provider
 * Gitea Remote Repositories v1.0.4
 * Shows all issues in a repository
 */
import * as vscode from 'vscode';
import { GiteaClient, Issue } from '../giteaApi/client';

export class IssueTreeProvider implements vscode.TreeDataProvider<IssueTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<IssueTreeItem | undefined | null | void> =
    new vscode.EventEmitter<IssueTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IssueTreeItem | undefined | null | void> =
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

  async getTreeItem(element: IssueTreeItem): Promise<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: IssueTreeItem): Promise<IssueTreeItem[]> {
    try {
      if (!this.client || !this.owner || !this.repo) {
        return [];
      }

      if (!element) {
        const issues = await this.client.getIssues(this.owner, this.repo, 'open');
        return issues
          .filter((i) => !i.pull_request) // Filter out PRs
          .map(
            (issue) =>
              new IssueTreeItem(
                `#${issue.number} - ${issue.title}`,
                vscode.TreeItemCollapsibleState.None,
                issue,
                issue.state === 'open'
              )
          );
      }

      return [];
    } catch (error) {
      console.error('Error getting issues:', error);
      return [];
    }
  }
}

export class IssueTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    issue: Issue,
    isOpen = true
  ) {
    super(label, collapsibleState);
    this.description = issue.user.login;
    this.iconPath = isOpen
      ? new vscode.ThemeIcon('issues')
      : new vscode.ThemeIcon('issue-closed');
    this.tooltip = issue.body;
    this.contextValue = isOpen ? 'issue-open' : 'issue-closed';
  }
}
