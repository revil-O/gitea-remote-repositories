# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-01-12

### Added
- **Responsive Design** - Mobile-first CSS with media queries for all screen sizes
- **Theme Support** - Automatic VS Code theme detection (Light/Dark/Custom)
- **CSS Variables** - Dynamic color adaptation based on VS Code settings
- **Accessibility** - prefers-reduced-motion support for animations
- **Print Styles** - Optimized print view for dashboard export
- **Fluid Typography** - clamp() for responsive font sizes (1.8em → 5vw → 2.8em)
- **Tab State Persistence** - Remember active tab using sessionStorage
- **Mobile Optimizations** - Touch-friendly scrolling, smaller padding on mobile

### Changed
- Converted hard-coded colors to CSS variables (--color-primary, --bg-secondary, etc.)
- Improved tablet experience (481px-1024px breakpoint)
- Enhanced desktop layout (1025px+ with 3-column grid)
- Updated typography with clamp() for fluid scaling
- All inline styles now use CSS variables for theme consistency
- Tab buttons now flex-wrap instead of horizontal scroll on small screens

### Fixed
- Light theme compatibility (white backgrounds, dark text)
- Grid layouts now respect device width (mobile: 1col, tablet: 2col, desktop: 3col)
- Removed hardcoded #2a2a2a colors - now use --border-color
- Dashboard now inherits VS Code editor colors properly
- Font families updated to monospace for code elements

### Security
- CSS variables scoped properly to prevent theme injection
- Print styles disable interactive elements

## [1.0.2] - 2026-01-12

### Added
- VS Code Offline Mode configuration (.vscode/settings.json)
- Extension recommendations file (.vscode/extensions.json)
- .vscodeignore for optimized VSIX packaging
- Offline configuration documentation (.vscode/OFFLINE_CONFIG.md)

### Changed
- Updated Extension display name to "Gitea remote repositories"
- Updated Extension description to "git remote request tool for gitea"
- Improved logo.png with SVG version (2.1 KB)
- All source file headers updated with v1.0.2 version marker
- Publisher information: "revilo - Oliver Schmidt"

### Fixed
- TypeScript compilation issues (full_name property, ConfigurationTarget)
- Removed unused src/views/treeDataProvider.ts
- ESLint errors and warnings
- Package scripts using yarn → npm

### Security
- Telemetry disabled in offline configuration
- Settings Sync disabled
- Marketplace endpoints disabled
- No auto-updates enabled

## [1.0.1] - 2026-01-12

### Added
- Virtual FileSystem Provider for gitea:// URI scheme
- AuthManager with VS Code SecretStorage integration
- 3 new TreeView Providers (Repositories, Branches, Issues)
- 6 new remote repository commands
- Extended API Client with file operations and branch management

### Changed
- Updated display name and description
- Publisher updated to "revilo - Oliver Schmidt"
- Improved code organization with proper layering
- Removed unused code and dependencies

### Fixed
- TypeScript compilation errors
- Unused code and imports
- ESLint warnings and code style issues