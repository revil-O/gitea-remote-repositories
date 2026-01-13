/**
 * Gitea Virtual FileSystem Provider
 * Gitea Remote Repositories v1.0.4
 * Implements vscode.FileSystemProvider for gitea:// URIs
 * Allows reading remote files without local clone
 */

import * as vscode from 'vscode';
import { GiteaClient } from '../giteaApi/client';
import { parseGiteaUri, getServerUrl } from '../utils/uriParser';
import { AuthManager } from '../auth/authManager';

export class GiteaFileSystemProvider implements vscode.FileSystemProvider {
  private clients: Map<string, GiteaClient> = new Map();
  private authManager: AuthManager;
  private cache: Map<string, Uint8Array> = new Map();

  private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Get or create API client for a server
   */
  private async getClient(server: string): Promise<GiteaClient> {
    if (this.clients.has(server)) {
      return this.clients.get(server)!;
    }

    const token = await this.authManager.getToken(server);
    if (!token) {
      throw new Error(`No authentication token found for ${server}`);
    }

    const baseUrl = getServerUrl(server);
    const client = new GiteaClient(baseUrl, token);
    this.clients.set(server, client);

    return client;
  }

  /**
   * Read file content
   */
  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const cacheKey = uri.toString();

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const giteaUri = parseGiteaUri(uri.toString());
      const client = await this.getClient(giteaUri.server);

      const content = await client.getFileContent(
        giteaUri.owner,
        giteaUri.repo,
        giteaUri.path,
        giteaUri.ref || 'HEAD'
      );

      // Cache the file
      const uint8Array = new TextEncoder().encode(content);
      this.cache.set(cacheKey, uint8Array);

      return uint8Array;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read file: ${msg}`);
    }
  }

  /**
   * Write file content (not supported in read-only mode)
   */
  async writeFile(
    _uri: vscode.Uri,
    _content: Uint8Array,
    _options: { create: boolean; overwrite: boolean }
  ): Promise<void> {
    throw vscode.FileSystemError.NoPermissions('Gitea remote files are read-only');
  }

  /**
   * Delete file (not supported in read-only mode)
   */
  async delete(_uri: vscode.Uri, _options: { recursive: boolean }): Promise<void> {
    throw vscode.FileSystemError.NoPermissions('Cannot delete remote files');
  }

  /**
   * Rename file (not supported in read-only mode)
   */
  async rename(
    _oldUri: vscode.Uri,
    _newUri: vscode.Uri,
    _options: { overwrite: boolean }
  ): Promise<void> {
    throw vscode.FileSystemError.NoPermissions('Cannot rename remote files');
  }

  /**
   * Create directory (not supported in read-only mode)
   */
  async createDirectory(_uri: vscode.Uri): Promise<void> {
    throw vscode.FileSystemError.NoPermissions('Cannot create remote directories');
  }

  /**
   * Get file stats
   */
  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    try {
      const giteaUri = parseGiteaUri(uri.toString());
      const client = await this.getClient(giteaUri.server);

      // Get file info from API
      const content = await client.getFileContent(
        giteaUri.owner,
        giteaUri.repo,
        giteaUri.path,
        giteaUri.ref || 'HEAD'
      );

      const size = new TextEncoder().encode(content).length;

      return {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size,
      };
    } catch (error) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  /**
   * Read directory
   */
  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    try {
      const giteaUri = parseGiteaUri(uri.toString());
      const client = await this.getClient(giteaUri.server);

      const entries = await client.listDirectoryContents(
        giteaUri.owner,
        giteaUri.repo,
        giteaUri.path || '',
        giteaUri.ref || 'HEAD'
      );

      return entries.map((entry) => [
        entry.name,
        entry.type === 'dir' ? vscode.FileType.Directory : vscode.FileType.File,
      ]);
    } catch (error) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  /**
   * Watch file for changes (not implemented for remote)
   */
  watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    // Remote files don't change unless synced from server
    // Return a dummy disposable
    return new vscode.Disposable(() => {
      // No-op
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear server-specific cache
   */
  clearServerCache(server: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key] of this.cache.entries()) {
      if (key.includes(server)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}
