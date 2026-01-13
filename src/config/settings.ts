/**
 * Settings and Configuration Management
 * Gitea Remote Repositories v1.0.4 - revilo - Oliver Schmidt
 */
import * as vscode from 'vscode';

export class Settings {
  private static readonly TOKEN_KEY = 'g2r.token';
  private static readonly HOST_KEY = 'g2r.host';
  private static readonly AUTO_CONNECT_KEY = 'g2r.autoConnect';
  private static readonly SHOW_WELCOME_KEY = 'g2r.showWelcome';
  private static readonly AUTO_FETCH_KEY = 'g2r.autoFetchPullRequests';
  private static readonly REFRESH_INTERVAL_KEY = 'g2r.refreshInterval';
  private static readonly TRUST_CERTS_KEY = 'g2r.trustInsecureCertificates';
  private static readonly LOGGING_KEY = 'g2r.enableLogging';
  private static readonly MAX_REPOS_KEY = 'g2r.maxRepositories';
  private static readonly LOCAL_CLONE_ENABLED_KEY = 'g2r.localClone.enabled';
  private static readonly LOCAL_CLONE_PATH_KEY = 'g2r.localClone.defaultPath';
  private static readonly AUTO_SYNC_ENABLED_KEY = 'g2r.autoSync.enabled';
  private static readonly AUTO_SYNC_INTERVAL_KEY = 'g2r.autoSync.interval';
  private static readonly SYNC_EXCLUDE_PATTERNS_KEY = 'g2r.sync.excludePatterns';

  static getToken(): string {
    const config = vscode.workspace.getConfiguration();
    return config.get<string>(this.TOKEN_KEY) || '';
  }

  static setToken(token: string): Thenable<void> {
    const config = vscode.workspace.getConfiguration();
    return config.update(this.TOKEN_KEY, token, vscode.ConfigurationTarget.Global);
  }

  static getHost(): string {
    const config = vscode.workspace.getConfiguration();
    return config.get<string>(this.HOST_KEY) || '';
  }

  static setHost(host: string): Thenable<void> {
    const config = vscode.workspace.getConfiguration();
    return config.update(this.HOST_KEY, host, vscode.ConfigurationTarget.Global);
  }

  static getAutoConnect(): boolean {
    const config = vscode.workspace.getConfiguration();
    return config.get<boolean>(this.AUTO_CONNECT_KEY) ?? false;
  }

  static getShowWelcome(): boolean {
    const config = vscode.workspace.getConfiguration();
    return config.get<boolean>(this.SHOW_WELCOME_KEY) ?? true;
  }

  static getAutoFetchPullRequests(): boolean {
    const config = vscode.workspace.getConfiguration();
    return config.get<boolean>(this.AUTO_FETCH_KEY) ?? true;
  }

  static getRefreshInterval(): number {
    const config = vscode.workspace.getConfiguration();
    return config.get<number>(this.REFRESH_INTERVAL_KEY) ?? 300;
  }

  static getTrustInsecureCertificates(): boolean {
    const config = vscode.workspace.getConfiguration();
    return config.get<boolean>(this.TRUST_CERTS_KEY) ?? true;
  }

  static getEnableLogging(): boolean {
    const config = vscode.workspace.getConfiguration();
    return config.get<boolean>(this.LOGGING_KEY) ?? false;
  }

  static getMaxRepositories(): number {
    const config = vscode.workspace.getConfiguration();
    return config.get<number>(this.MAX_REPOS_KEY) ?? 50;
  }

  static isLocalCloneEnabled(): boolean {
    const config = vscode.workspace.getConfiguration();
    return config.get<boolean>(this.LOCAL_CLONE_ENABLED_KEY) ?? true;
  }

  static getLocalClonePath(): string {
    const config = vscode.workspace.getConfiguration();
    const defaultPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 
                       (process.env.HOME || process.env.USERPROFILE || '/');
    return config.get<string>(this.LOCAL_CLONE_PATH_KEY) || defaultPath;
  }

  static setLocalClonePath(path: string): Thenable<void> {
    const config = vscode.workspace.getConfiguration();
    return config.update(this.LOCAL_CLONE_PATH_KEY, path, vscode.ConfigurationTarget.Global);
  }

  static isAutoSyncEnabled(): boolean {
    const config = vscode.workspace.getConfiguration();
    return config.get<boolean>(this.AUTO_SYNC_ENABLED_KEY) ?? false;
  }

  static getAutoSyncInterval(): number {
    const config = vscode.workspace.getConfiguration();
    return config.get<number>(this.AUTO_SYNC_INTERVAL_KEY) ?? 300;
  }

  static getSyncExcludePatterns(): string[] {
    const config = vscode.workspace.getConfiguration();
    return config.get<string[]>(this.SYNC_EXCLUDE_PATTERNS_KEY) ?? [
      'node_modules/**',
      '.git/**',
      '.vscode/**',
      '.env'
    ];
  }

  static getSettingState(): SettingState {
    const token = this.getToken();
    const host = this.getHost();

    let state = SettingState.OK;
    
    if (!token) {
      state |= SettingState.NO_TOKEN;
    }
    if (!host) {
      state |= SettingState.NO_HOST;
    }
    
    return state;
  }

  static isConfigured(): boolean {
    return this.getSettingState() === SettingState.OK;
  }
}

export enum SettingState {
  OK = 0,
  NO_TOKEN = 1,
  NO_HOST = 2,
  NO_TOKEN_AND_HOST = 3
}
