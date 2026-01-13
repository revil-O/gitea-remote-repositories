/**
 * Commands for Remote Repository Operations
 * Gitea Remote Repositories v1.0.4
 * Connect, browse, and interact with Gitea repositories
 */
import * as vscode from 'vscode';
import { GiteaClient } from '../giteaApi/client';
import { AuthManager } from '../auth/authManager';
import { createGiteaUri, getServerUrl } from '../utils/uriParser';
import { Settings } from '../config/settings';

/**
 * Connect to Gitea server
 */
export async function handleConnect(
  authManager: AuthManager,
  context: vscode.ExtensionContext
): Promise<{ server: string; client: GiteaClient } | null> {
  try {
    // First check if we have configured host and token in settings
    let server = Settings.getHost() || '';
    let token = Settings.getToken() || '';

    // If settings are empty, prompt user
    if (!server || !token) {
      const serverInput = await vscode.window.showInputBox({
        prompt: 'Enter Gitea server URL',
        value: server || '',
        placeHolder: 'e.g., gitea.example.com or localhost:3000',
        validateInput: (value) => {
          if (!value) return 'Server address cannot be empty';
          return null;
        },
      });

      if (!serverInput) return null;
      server = serverInput;

      // Save to settings
      await Settings.setHost(server);

      const tokenInput = await vscode.window.showInputBox({
        prompt: 'Enter your Gitea API token',
        password: true,
        placeHolder: 'Your personal access token',
        validateInput: (value) => {
          if (!value) return 'Token cannot be empty';
          return null;
        },
      });

      if (!tokenInput) return null;
      token = tokenInput;

      // Save to settings
      await Settings.setToken(token);
    }

    // Test connection
    const baseUrl = getServerUrl(server);
    const client = new GiteaClient(baseUrl, token);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Testing Gitea connection...',
      },
      async () => {
        const user = await client.getCurrentUser();
        
        // Save credentials
        await authManager.setToken(server, token, user.login);
        await authManager.addServer(context, server);
      }
    );

    vscode.window.showInformationMessage(`✓ Connected to Gitea as ${token.substring(0, 8)}...!`);
    return { server, client };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to connect: ${msg}`);
    return null;
  }
}

/**
 * Open a repository (shows file tree)
 */
export async function handleOpenRepository(
  server: string,
  owner: string,
  repo: string,
  client: GiteaClient
): Promise<void> {
  try {
    // Simply show information message - the repo is now selected
    // Update the branches and issues views to show this repo's data
    vscode.window.showInformationMessage(
      `📂 Selected repository: ${owner}/${repo}\n\nBranches and Issues views have been updated.`
    );

    // The actual update is handled by the command that calls this
    // (in extension.ts where we update branchTreeProvider and issueTreeProvider)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to open repository: ${msg}`);
  }
}

/**
 * Open a file from remote repository
 */
export async function handleOpenFile(
  server: string,
  owner: string,
  repo: string,
  path: string,
  ref = 'HEAD'
): Promise<void> {
  try {
    const fileUri = vscode.Uri.parse(createGiteaUri(server, owner, repo, path, ref));
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to open file: ${msg}`);
  }
}

/**
 * Clone repository to local filesystem
 */
export async function handleCloneToLocal(
  server: string,
  owner: string,
  repo: string,
  client: GiteaClient
): Promise<void> {
  try {
    const repoInfo = await client.getRepositoryDetail(owner, repo);
    
    // Get clone URL
    const cloneUrl = repoInfo.clone_url;
    
    // Open in terminal with git clone command
    const terminal = vscode.window.createTerminal('Gitea Clone');
    terminal.sendText(`git clone "${cloneUrl}"`);
    terminal.show();

    vscode.window.showInformationMessage(
      `Clone command sent to terminal. Repository: ${owner}/${repo}`
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to clone repository: ${msg}`);
  }
}

/**
 * Search repositories on Gitea
 */
export async function handleSearchRepositories(client: GiteaClient): Promise<void> {
  try {
    const query = await vscode.window.showInputBox({
      prompt: 'Search for repositories',
      placeHolder: 'Repository name',
    });

    if (!query) return;

    const repos = await client.searchRepositories(query);

    if (repos.length === 0) {
      vscode.window.showInformationMessage('No repositories found');
      return;
    }

    const selected = await vscode.window.showQuickPick(
      repos.map((r) => ({
        label: `${r.owner.login}/${r.name}`,
        description: r.description || '(no description)',
        repo: r,
      })),
      { placeHolder: 'Select a repository' }
    );

    if (selected) {
      // Handle selection - could open file picker, etc.
      vscode.window.showInformationMessage(
        `Selected: ${selected.repo.owner.login}/${selected.repo.name}`
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Search failed: ${msg}`);
  }
}
