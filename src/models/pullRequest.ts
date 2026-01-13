/**
 * Gitea Pull Request Model
 */

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  description: string;
  state: 'open' | 'closed';
  head: {
    ref: string;
    sha: string;
    repo: {
      name: string;
      full_name: string;
      owner: {
        login: string;
      };
    };
  };
  base: {
    ref: string;
    sha: string;
    repo: {
      name: string;
      full_name: string;
      owner: {
        login: string;
      };
    };
  };
  user: {
    login: string;
    avatar_url: string;
  };
  assignee?: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  merged: boolean;
  merged_by?: {
    login: string;
  };
  mergeable: boolean;
  mergeable_state?: string;
  merge_base?: string;
  comments?: number;
}

export interface PullRequestFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'type-change' | 'unknown';
  patch?: string;
  old_name?: string;
  additions: number;
  deletions: number;
  changes: number;
}

export interface PullRequestComment {
  id: number;
  created_at: string;
  updated_at: string;
  body: string;
  user: {
    login: string;
    avatar_url: string;
  };
}
