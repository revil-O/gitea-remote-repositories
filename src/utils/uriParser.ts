/**
 * Gitea URI Parser
 * Parst URIs im Format: gitea://server/owner/repo/path
 * Beispiel: gitea://gitea.example.com/user/myrepo/src/main.ts
 */

export interface GiteaUri {
  server: string;        // Hostname/URL ohne Protocol
  owner: string;         // Repository owner
  repo: string;          // Repository name
  path: string;          // File path
  ref?: string;          // Git reference (branch/tag/commit)
}

export interface GiteaPath {
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

/**
 * Parse VS Code URI to Gitea URI
 * gitea://gitea.example.com/owner/repo/path/to/file.ts?ref=main
 */
export function parseGiteaUri(uri: string): GiteaUri {
  try {
    const url = new URL(uri);
    
    if (url.protocol !== 'gitea:') {
      throw new Error(`Invalid protocol: ${url.protocol}, expected gitea:`);
    }

    const server = url.hostname;
    const pathname = url.pathname.slice(1); // Remove leading slash
    const parts = pathname.split('/');

    if (parts.length < 2) {
      throw new Error('Invalid Gitea URI: requires at least owner and repo');
    }

    const owner = parts[0];
    const repo = parts[1];
    const path = parts.slice(2).join('/') || '';
    const ref = url.searchParams.get('ref') || 'HEAD';

    return {
      server,
      owner,
      repo,
      path,
      ref,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse Gitea URI: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create Gitea URI from components
 */
export function createGiteaUri(
  server: string,
  owner: string,
  repo: string,
  path: string,
  ref = 'HEAD'
): string {
  const base = `gitea://${server}/${owner}/${repo}`;
  const filePath = path ? `/${path}` : '';
  const refParam = ref && ref !== 'HEAD' ? `?ref=${ref}` : '';
  return `${base}${filePath}${refParam}`;
}

/**
 * Check if URI is a Gitea URI
 */
export function isGiteaUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === 'gitea:';
  } catch {
    return false;
  }
}

/**
 * Get server URL from Gitea URI
 */
export function getServerUrl(server: string): string {
  // Try to infer protocol
  if (server.includes('localhost') || server.includes('127.0.0.1')) {
    return `http://${server}`;
  }
  return `https://${server}`;
}
