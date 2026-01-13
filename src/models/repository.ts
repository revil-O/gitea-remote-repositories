/**
 * Repository Model
 */

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  description: string;
  url: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
}

export interface RepositoryInfo {
  owner: string;
  repo: string;
  branch: string;
}
