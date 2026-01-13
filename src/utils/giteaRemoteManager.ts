/**
 * Gitea Remote Repository Manager
 * Gitea Remote Repositories v1.0.4
 * Detects and manages .gitea-remote.json metadata files
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface GiteaRemoteMetadata {
  server: string;
  owner: string;
  repo: string;
  branch: string;
  timestamp: number;
}

export class GiteaRemoteManager {
  private static readonly METADATA_FILE = '.gitea-remote.json';

  /**
   * Save Gitea repository metadata to folder
   */
  static saveMetadata(
    folderPath: string,
    metadata: GiteaRemoteMetadata
  ): void {
    try {
      const filePath = path.join(folderPath, this.METADATA_FILE);
      const data = JSON.stringify(metadata, null, 2);
      fs.writeFileSync(filePath, data, 'utf8');
      
      if (metadata.repo) {
        console.log(
          `[Gitea] Saved remote metadata for ${metadata.owner}/${metadata.repo}`
        );
      }
    } catch (error) {
      console.error('Failed to save Gitea remote metadata:', error);
    }
  }

  /**
   * Load Gitea repository metadata from folder
   */
  static loadMetadata(folderPath: string): GiteaRemoteMetadata | null {
    try {
      const filePath = path.join(folderPath, this.METADATA_FILE);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      const metadata = JSON.parse(data) as GiteaRemoteMetadata;
      
      console.log(
        `[Gitea] Loaded remote metadata for ${metadata.owner}/${metadata.repo}`
      );
      return metadata;
    } catch (error) {
      console.error('Failed to load Gitea remote metadata:', error);
      return null;
    }
  }

  /**
   * Check if folder has Gitea remote metadata
   */
  static hasMetadata(folderPath: string): boolean {
    const filePath = path.join(folderPath, this.METADATA_FILE);
    return fs.existsSync(filePath);
  }

  /**
   * Get metadata from current workspace folder
   */
  static getCurrentFolderMetadata(): GiteaRemoteMetadata | null {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      return this.loadMetadata(folderPath);
    }
    return null;
  }

  /**
   * Remove metadata file from folder
   */
  static removeMetadata(folderPath: string): void {
    try {
      const filePath = path.join(folderPath, this.METADATA_FILE);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('[Gitea] Removed remote metadata');
      }
    } catch (error) {
      console.error('Failed to remove Gitea remote metadata:', error);
    }
  }

  /**
   * Update metadata in folder
   */
  static updateMetadata(
    folderPath: string,
    updates: Partial<GiteaRemoteMetadata>
  ): void {
    const metadata = this.loadMetadata(folderPath);
    if (metadata) {
      const updated = { ...metadata, ...updates, timestamp: Date.now() };
      this.saveMetadata(folderPath, updated);
    }
  }
}
