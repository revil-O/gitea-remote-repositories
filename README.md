# Gitea Remote Repositories - G2R

A VS Code extension for seamless integration with Gitea servers - browse repositories, manage pull requests, and access files directly.

**Version:** 1.0.4 | **Status:** Production Ready

---

## Quick Start

1. Install the extension
2. Configure settings:
   - `g2r.host`: Your Gitea server URL (e.g., `http://localhost:3000`)
   - `g2r.token`: Your Gitea API token
3. Use `Gitea: Connect to Server` command to start

---

## Key Features

- **Repository Browser** - Search, browse, and manage repositories from Gitea
- **Virtual FileSystem** - Open files directly with `gitea://` protocol
- **Pull Requests** - View, diff, accept/reject PRs
- **Secure Auth** - Token-based auth with VS Code SecretStorage
- **Multi-Server Support** - Connect to multiple Gitea instances
- **Branch & Issue Management** - Browse branches and track issues

---

## Essential Commands

- `Gitea: Connect to Server` - Connect to a Gitea server
- `Gitea: Open Repository` - Open repository in explorer
- `Gitea: Open File` - Access files from repositories
- `Gitea: Clone Repository` - Clone repository to local filesystem
- `Gitea: Search Repositories` - Find repositories
- `Gitea: Configure Settings` - Manage extension settings

---

## Virtual FileSystem Usage

Open files from Gitea using the URI scheme:
```
gitea://server-hostname/owner/repo/path/to/file.ts?ref=branch-name
```

Example:
```
gitea://gitea.example.com/myuser/myrepo/src/index.ts?ref=main
```

---

## Requirements

- VS Code 1.75.0+
- Gitea Server 1.18+
- Valid Gitea API token

---

## Development

### Setup

```bash
npm install
npm run compile
npm run watch
```

### Build

```bash
npm run package
```

### Testing

```bash
npm test
```

---

## License

MIT License - See [LICENSE](LICENSE)

For details, check the [CHANGELOG](CHANGELOG.md).
