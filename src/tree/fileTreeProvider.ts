/**
 * File TreeView Provider for Gitea
 * Gitea Remote Repositories v1.0.4
 * Shows files and directories from a Gitea repository
 */
import * as vscode from 'vscode';
import { GiteaClient, DirectoryEntry } from '../giteaApi/client';

export class FileTreeProvider implements vscode.TreeDataProvider<FileTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileTreeItem | undefined | null | void> =
    new vscode.EventEmitter<FileTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<FileTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private client: GiteaClient | null = null;
  private currentOwner: string = '';
  private currentRepo: string = '';
  private currentBranch: string = 'master';

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setRepository(owner: string, repo: string, branch: string = 'master', client: GiteaClient): void {
    this.currentOwner = owner;
    this.currentRepo = repo;
    this.currentBranch = branch;
    this.client = client;
    this.refresh();
  }

  async getTreeItem(element: FileTreeItem): Promise<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
    try {
      if (!this.client || !this.currentOwner || !this.currentRepo) {
        return [
          new FileTreeItem(
            'No repository selected',
            vscode.TreeItemCollapsibleState.None,
            'info'
          ),
        ];
      }

      let path = '';
      if (element) {
        path = element.path;
      }

      // Get files from Gitea API
      const entries = await this.client.getRepositoryContents(
        this.currentOwner,
        this.currentRepo,
        path,
        this.currentBranch
      );

      // Sort: directories first, then files
      const sorted = entries.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      });

      return sorted.map(
        (entry) =>
          new FileTreeItem(
            entry.name,
            entry.type === 'dir'
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            entry.type === 'dir' ? 'folder' : 'file',
            entry.path,
            {
              command: 'gitea.openFile',
              title: 'Open File',
              arguments: [
                this.currentOwner,
                this.currentRepo,
                entry.path,
                this.currentBranch,
              ],
            }
          )
      );
    } catch (error) {
      console.error('Error getting files:', error);
      return [
        new FileTreeItem(
          'Error loading files',
          vscode.TreeItemCollapsibleState.None,
          'error'
        ),
      ];
    }
  }
}

export class FileTreeItem extends vscode.TreeItem {
  public path: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    icon: string,
    path: string = '',
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.path = path;
    this.command = command;
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}
