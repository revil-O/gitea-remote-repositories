/**
 * Show Active Pull Request Details
 */
import * as vscode from 'vscode';
import { PullRequest } from '../models/pullRequest';

export async function handleActivePullRequest(pullRequest: PullRequest): Promise<void> {
  try {
    // Update context to show active PR state
    vscode.commands.executeCommand('setContext', 'ACTIVE_PULL', true);
    vscode.commands.executeCommand('setContext', 'ACTIVE_PULL_CONFLICT', !pullRequest.mergeable);

    // Show pull request details in output channel
    const outputChannel = vscode.window.createOutputChannel(`PR #${pullRequest.number}`);
    outputChannel.clear();

    const details = formatPullRequestDetails(pullRequest);
    outputChannel.append(details);
    outputChannel.show(true);
  } catch (error) {
    console.error('Active PR error:', error);
    vscode.window.showErrorMessage('Failed to show PR details');
  }
}

function formatPullRequestDetails(pr: PullRequest): string {
  const lines: string[] = [];

  lines.push(`╔═══════════════════════════════════════════════════════════════╗`);
  lines.push(`║ Pull Request #${pr.number}`);
  lines.push(`╚═══════════════════════════════════════════════════════════════╝`);
  lines.push(``);

  lines.push(`Title: ${pr.title}`);
  lines.push(`State: ${pr.state.toUpperCase()}`);
  lines.push(`Mergeable: ${pr.mergeable ? '✓ Yes' : '✗ No'}`);
  lines.push(``);

  lines.push(`Author: ${pr.user.login}`);
  lines.push(`Created: ${new Date(pr.created_at).toLocaleString()}`);
  lines.push(`Updated: ${new Date(pr.updated_at).toLocaleString()}`);
  lines.push(``);

  if (pr.merged) {
    lines.push(`Status: ✓ MERGED`);
    if (pr.merged_by) {
      lines.push(`Merged by: ${pr.merged_by.login}`);
    }
  } else if (pr.state === 'closed') {
    lines.push(`Status: ✓ CLOSED`);
  } else {
    lines.push(`Status: ⧖ OPEN`);
  }

  lines.push(``);
  lines.push(`Base: ${pr.base.repo.owner.login}/${pr.base.repo.name}:${pr.base.ref}`);
  lines.push(`Head: ${pr.head.repo.owner.login}/${pr.head.repo.name}:${pr.head.ref}`);
  lines.push(``);

  if (pr.description) {
    lines.push(`Description:`);
    lines.push(`───────────────────────────────────────────────────────────────`);
    lines.push(pr.description);
    lines.push(`───────────────────────────────────────────────────────────────`);
  }

  lines.push(``);
  lines.push(`Comments: ${pr.comments || 0}`);

  return lines.join('\n');
}
