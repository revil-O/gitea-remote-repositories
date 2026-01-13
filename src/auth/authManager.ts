/**
 * Authentication Manager
 * Gitea Remote Repositories v1.0.4
 * Handles token storage, retrieval, and validation
 * Uses VS Code SecretStorage for secure token management
 */

import * as vscode from 'vscode';

export interface AuthConfig {
  server: string;
  token: string;
  username?: string;
  oauth2?: {
    clientId: string;
    clientSecret: string;
  };
}

export class AuthManager {
  private secrets: vscode.SecretStorage;
  private configCache: Map<string, AuthConfig> = new Map();

  constructor(secrets: vscode.SecretStorage) {
    this.secrets = secrets;
  }

  /**
   * Get auth token for a Gitea server
   */
  async getToken(server: string): Promise<string | undefined> {
    const cacheKey = `gitea:${server}:token`;

    // Check cache first
    if (this.configCache.has(server)) {
      return this.configCache.get(server)?.token;
    }

    // Get from secure storage
    const token = await this.secrets.get(cacheKey);
    return token;
  }

  /**
   * Save auth token for a Gitea server
   */
  async setToken(server: string, token: string, username?: string): Promise<void> {
    const cacheKey = `gitea:${server}:token`;
    const userKey = `gitea:${server}:user`;

    // Store in VS Code secure storage
    await this.secrets.store(cacheKey, token);
    if (username) {
      await this.secrets.store(userKey, username);
    }

    // Update cache
    this.configCache.set(server, { server, token, username });
  }

  /**
   * Remove auth token for a Gitea server
   */
  async deleteToken(server: string): Promise<void> {
    const cacheKey = `gitea:${server}:token`;
    const userKey = `gitea:${server}:user`;

    await this.secrets.delete(cacheKey);
    await this.secrets.delete(userKey);

    this.configCache.delete(server);
  }

  /**
   * Get username for a Gitea server
   */
  async getUsername(server: string): Promise<string | undefined> {
    const userKey = `gitea:${server}:user`;
    return this.secrets.get(userKey);
  }

  /**
   * Check if server is configured
   */
  async isConfigured(server: string): Promise<boolean> {
    const token = await this.getToken(server);
    return !!token;
  }

  /**
   * Get all configured servers
   */
  async getConfiguredServers(): Promise<string[]> {
    // This is a limitation - SecretStorage doesn't expose all keys
    // Use workspace state as fallback
    const config = vscode.workspace.getConfiguration('gitea');
    const servers = config.get<string[]>('servers') || [];
    return servers;
  }

  /**
   * List all stored servers in config
   */
  async listServers(context: vscode.ExtensionContext): Promise<string[]> {
    const workspaceState = context.workspaceState;
    const servers = workspaceState.get<string[]>('gitea.servers') || [];
    return servers;
  }

  /**
   * Add server to known servers list
   */
  async addServer(context: vscode.ExtensionContext, server: string): Promise<void> {
    const workspaceState = context.workspaceState;
    const servers = workspaceState.get<string[]>('gitea.servers') || [];
    
    if (!servers.includes(server)) {
      servers.push(server);
      await workspaceState.update('gitea.servers', servers);
    }
  }
}
