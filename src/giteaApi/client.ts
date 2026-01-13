/**
 * Gitea API Client
 * Gitea Remote Repositories v1.0.4 - revilo - Oliver Schmidt
 * Handles all communication with Gitea API
 * Supports both old constructor (from settings) and new (with explicit URL/token)
 */
import fetch from 'cross-fetch';
import https from 'https';
import http from 'http';
import { Settings } from '../config/settings';
import { PullRequest, PullRequestFile, PullRequestComment } from '../models/pullRequest';
import { Repository } from '../models/repository';

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size?: number;
  download_url?: string;
  path: string;
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  pull_request?: {
    url: string;
  };
}

export class GiteaClient {
  private baseUrl: string;
  private token: string;
  private protocolDetected: boolean = false;
  private trustInsecureCerts: boolean = false;
  private enableLogging: boolean = false;

  constructor(baseUrl?: string, token?: string) {
    // Support both old and new constructor
    if (baseUrl && token) {
      // New style: explicit URL and token
      let url = baseUrl;
      // Add https:// if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      this.baseUrl = url.endsWith('/api/v1') ? url : `${url}/api/v1`;
      this.token = token;
    } else {
      // Old style: use settings
      let host = Settings.getHost();
      // Add https:// if missing
      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        host = `https://${host}`;
      }
      this.baseUrl = host.endsWith('/api/v1') ? host : `${host}/api/v1`;
      this.token = Settings.getToken();
    }

    // Load settings
    this.trustInsecureCerts = Settings.getTrustInsecureCertificates();
    this.enableLogging = Settings.getEnableLogging();

    if (this.enableLogging) {
      console.log(`[Gitea] Initialized client for ${this.baseUrl}`);
    }
  }

  async initializeConnection(): Promise<void> {
    if (this.protocolDetected) return;
    
    try {
      // Try to detect the correct protocol
      const detectedUrl = await this.detectProtocol(this.baseUrl);
      const finalUrl = detectedUrl.endsWith('/api/v1') ? detectedUrl : `${detectedUrl}/api/v1`;
      this.baseUrl = finalUrl;
      this.protocolDetected = true;
    } catch (err) {
      // If detection fails, keep the original baseUrl
      console.error('Protocol detection failed:', err);
      this.protocolDetected = true; // Mark as detected even if failed to avoid retries
    }
  }

  /**
   * Detect the correct protocol (HTTPS or HTTP) for the Gitea server
   */
  private async detectProtocol(baseUrl: string): Promise<string> {
    const sslErrors = [
      "WRONG_VERSION_NUMBER",
      "EPROTO",
      "ECONNRESET",
      "CERT",
      "SELF_SIGNED",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
    ];

    // Parse host and port from baseUrl
    let testUrl = baseUrl;
    if (testUrl.endsWith('/api/v1')) {
      testUrl = testUrl.replace('/api/v1', '');
    }

    // Try HTTPS first with agent that accepts self-signed certs
    const httpsUrl = `${testUrl}/api/v1/version`;
    try {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
      const res = await fetch(httpsUrl, {
        method: "GET",
        agent: httpsAgent,
      } as any);
      if (res.ok) {
        return testUrl;
      }
    } catch (err: any) {
      // Check if it's a typical SSL error that warrants HTTP fallback
      const errorMsg = err.message || err.toString();
      if (sslErrors.some(e => errorMsg.includes(e))) {
        // Try HTTP as fallback
        const httpUrl = `http://${testUrl.replace(/^https?:\/\//, '')}/api/v1/version`;
        try {
          const res = await fetch(httpUrl, { method: "GET" } as any);
          if (res.ok) {
            return httpUrl.replace('/api/v1/version', '');
          }
        } catch (_) {
          // HTTP also failed, throw original HTTPS error
          throw err;
        }
      }
    }

    return testUrl;
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    // Auto-detect protocol on first request
    if (!this.protocolDetected) {
      await this.initializeConnection();
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    if (this.enableLogging) {
      console.log(`[Gitea API] ${method} ${url}`);
    }

    const headers: HeadersInit = {
      'Authorization': `token ${this.token}`,
      'Content-Type': 'application/json',
    };

    // Create appropriate agent based on protocol
    let agent: any;
    if (url.startsWith('https://')) {
      agent = new https.Agent({
        rejectUnauthorized: !this.trustInsecureCerts, // Use setting to control cert validation
      });
    } else {
      agent = new http.Agent();
    }

    const options: any = {
      method,
      headers,
      agent,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(
        `API Error [${response.status}]: ${response.statusText} - ${endpoint}`
      );
    }

    const data = await response.json();
    return data as T;
  }

  /**
   * Get all pull requests for a repository
   */
  async getPullRequests(owner: string, repo: string, state: 'open' | 'closed' = 'open'): Promise<PullRequest[]> {
    const endpoint = `/repos/${owner}/${repo}/pulls?state=${state}`;
    return this.request<PullRequest[]>(endpoint);
  }

  /**
   * Get a single pull request
   */
  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${number}`;
    return this.request<PullRequest>(endpoint);
  }

  /**
   * Get files changed in a pull request
   */
  async getPullRequestFiles(owner: string, repo: string, number: number): Promise<PullRequestFile[]> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${number}/files`;
    return this.request<PullRequestFile[]>(endpoint);
  }

  /**
   * Get comments on a pull request
   */
  async getPullRequestComments(owner: string, repo: string, number: number): Promise<PullRequestComment[]> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${number}/comments`;
    return this.request<PullRequestComment[]>(endpoint);
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    number: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge'
  ): Promise<any> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${number}/merge`;
    return this.request<any>(endpoint, 'POST', {
      merge_method: mergeMethod,
    });
  }

  /**
   * Close a pull request
   */
  async closePullRequest(owner: string, repo: string, number: number): Promise<PullRequest> {
    const endpoint = `/repos/${owner}/${repo}/pulls/${number}`;
    return this.request<PullRequest>(endpoint, 'PATCH', {
      state: 'closed',
    });
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<Repository> {
    const endpoint = `/repos/${owner}/${repo}`;
    return this.request<Repository>(endpoint);
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<any> {
    const endpoint = `/user`;
    return this.request<any>(endpoint);
  }

  /**
   * Get file content (base64 decoded)
   * For Virtual FileSystem provider
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref = 'HEAD'
  ): Promise<string> {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
    const data = await this.request<any>(endpoint);
    
    if (data.content) {
      // Content is base64 encoded
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    
    throw new Error('File content not found');
  }

  /**
   * List directory contents
   */
  async listDirectoryContents(
    owner: string,
    repo: string,
    path: string,
    ref = 'HEAD'
  ): Promise<DirectoryEntry[]> {
    const endpoint = `/repos/${owner}/${repo}/contents/${path || ''}?ref=${ref}`;
    return this.request<DirectoryEntry[]>(endpoint);
  }

  /**
   * Get all branches for a repository
   */
  async getBranches(owner: string, repo: string): Promise<Branch[]> {
    const endpoint = `/repos/${owner}/${repo}/branches`;
    return this.request<Branch[]>(endpoint);
  }

  /**
   * Get all issues for a repository
   */
  async getIssues(owner: string, repo: string, state: 'open' | 'closed' = 'open'): Promise<Issue[]> {
    const endpoint = `/repos/${owner}/${repo}/issues?state=${state}`;
    return this.request<Issue[]>(endpoint);
  }

  /**
   * Get a single issue
   */
  async getIssue(owner: string, repo: string, number: number): Promise<Issue> {
    const endpoint = `/repos/${owner}/${repo}/issues/${number}`;
    return this.request<Issue>(endpoint);
  }

  /**
   * Create a new branch
   */
  async createBranch(owner: string, repo: string, branchName: string, oldBranchName = 'main'): Promise<Branch> {
    const endpoint = `/repos/${owner}/${repo}/branches`;
    return this.request<Branch>(endpoint, 'POST', {
      new_branch_name: branchName,
      old_branch_name: oldBranchName,
    });
  }

  /**
   * Get repository details
   */
  async getRepositoryDetail(owner: string, repo: string): Promise<Repository> {
    const endpoint = `/repos/${owner}/${repo}`;
    return this.request<Repository>(endpoint);
  }

  /**
   * Get all repositories for the authenticated user
   */
  async getUserRepositories(): Promise<Repository[]> {
    const endpoint = `/user/repos?limit=100`;
    return this.request<Repository[]>(endpoint);
  }

  /**
   * Get repositories owned by a specific user/org
   */
  async getRepositoriesByOwner(owner: string): Promise<Repository[]> {
    const endpoint = `/users/${owner}/repos?limit=100`;
    return this.request<Repository[]>(endpoint);
  }

  /**
   * Search repositories
   */
  async searchRepositories(query: string, limit = 20): Promise<Repository[]> {
    const endpoint = `/repos/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const data = await this.request<any>(endpoint);
    return data.data || [];
  }

  /**
   * Get repository contents (files and directories)
   */
  async getRepositoryContents(
    owner: string,
    repo: string,
    path: string = '',
    ref: string = 'master'
  ): Promise<DirectoryEntry[]> {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
    try {
      const data = await this.request<any[]>(endpoint);
      return data.map((item) => ({
        name: item.name,
        type: item.type === 'dir' ? 'dir' : 'file',
        size: item.size,
        path: item.path,
        download_url: item.download_url,
      }));
    } catch (error) {
      console.error('Error getting repository contents:', error);
      return [];
    }
  }
}
