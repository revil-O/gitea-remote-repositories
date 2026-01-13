.PHONY: help build compile package release release-dry release-force release-fix clean install test

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

VERSION := $(shell grep '"version"' package.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
PACKAGE_NAME := $(shell grep '"name"' package.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
GIT_VERSION := v$(VERSION)
VSIX_FILE := $(PACKAGE_NAME)-$(VERSION).vsix

help:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║ Gitea Remote Repositories Build & Release System           ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(YELLOW)Build Targets:$(NC)"
	@echo "  $(GREEN)make compile$(NC)         Compile TypeScript to JavaScript"
	@echo "  $(GREEN)make package$(NC)         Create VSIX package"
	@echo "  $(GREEN)make build$(NC)           Compile + Package (full build)"
	@echo ""
	@echo "$(YELLOW)Release Targets:$(NC)"
	@echo "  $(GREEN)make release$(NC)         Build + Create Gitea release + Upload VSIX"
	@echo "  $(GREEN)make release-dry$(NC)     Preview release (dry-run)"
	@echo "  $(GREEN)make release-force$(NC)   Force update existing release"
	@echo "  $(GREEN)make release-fix$(NC)     Create releases for all Git tags with VSIX"
	@echo "  $(GREEN)make upload$(NC)          Upload VSIX to existing release"
	@echo ""
	@echo "$(YELLOW)Utility Targets:$(NC)"
	@echo "  $(GREEN)make install$(NC)         Install into VS Code"
	@echo "  $(GREEN)make test$(NC)            Run tests"
	@echo "  $(GREEN)make clean$(NC)           Remove build artifacts"
	@echo "  $(GREEN)make version$(NC)         Show version info"
	@echo ""
	@echo "$(YELLOW)Variables:$(NC)"
	@echo "  VERSION=$(VERSION)"
	@echo "  GIT_VERSION=$(GIT_VERSION)"
	@echo "  VSIX=$(VSIX_FILE)"

version:
	@echo "$(BLUE)Version Information:$(NC)"
	@echo "  npm: $(VERSION)"
	@echo "  git: $(GIT_VERSION)"
	@echo "  vsix: $(VSIX_FILE)"
	@echo "  git describe: $$(git describe --tags 2>/dev/null || echo 'no tags')"

# Compile TypeScript
compile:
	@echo "$(BLUE)Compiling TypeScript...$(NC)"
	@npm run compile
	@echo "$(BLUE)Updating README.md version...$(NC)"
	@bash ./update-readme-version.sh
	@echo "$(GREEN)✓ Compilation successful$(NC)"

# Create VSIX package
package: compile
	@echo "$(BLUE)Creating VSIX package...$(NC)"
	@npx vsce package --no-dependencies --allow-star-activation --baseContentUrl "http://10.10.0.254:3002/revilo/Gitea-remote-repositories/raw/branch/master" -o release/
	@echo "$(GREEN)✓ Package created: release/$(VSIX_FILE)$(NC)"

# Full build
build: compile package
	@echo ""
	@echo "$(GREEN)✓ Build complete!$(NC)"
	@ls -lh release/$(VSIX_FILE)

# Dry-run release (preview)
release-dry: build
	@echo ""
	@echo "$(BLUE)Previewing release...$(NC)"
	@./release.sh $(GIT_VERSION) --dry-run

# Create release in Gitea
release: build
	@echo ""
	@echo "$(BLUE)Creating release in Gitea...$(NC)"
	@./release.sh $(GIT_VERSION)
	@echo "$(GREEN)✓ Release created!$(NC)"

# Force update existing release
release-force: build
	@echo ""
	@echo "$(YELLOW)Force updating release in Gitea...$(NC)"
	@./release.sh $(GIT_VERSION) --force
	@echo "$(GREEN)✓ Release updated!$(NC)"

# Create releases for all Git tags with VSIX upload
release-fix:
	@echo "$(BLUE)Creating/Fixing releases for all Git tags...$(NC)"
	@if [ -z "$$GITEA_TOKEN" ]; then \
		echo "$(RED)✗ GITEA_TOKEN not set$(NC)"; \
		echo ""; \
		echo "Setup:"; \
		echo "  1. Get token from: http://10.10.0.254:3002/user/settings/applications"; \
		echo "  2. Run: export GITEA_TOKEN=<token>"; \
		echo "  3. Then: make release-fix"; \
		exit 1; \
	fi
	@echo ""
	@./fix-releases.sh
	@echo "$(GREEN)✓ All releases fixed!$(NC)"

# Upload VSIX to latest release
upload:
	@if [ ! -f "release/$(VSIX_FILE)" ]; then \
		echo "$(RED)✗ VSIX file not found: release/$(VSIX_FILE)$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Uploading VSIX to release...$(NC)"
	@./release.sh $(GIT_VERSION) --no-build

# Install extension
install: build
	@echo "$(BLUE)Installing extension into VS Code...$(NC)"
	@code --install-extension "release/$(VSIX_FILE)" --force
	@echo "$(GREEN)✓ Extension installed!$(NC)"
	@echo "   ID: revilo - oliver schmidt.g2r"

# Run tests
test:
	@echo "$(BLUE)Running tests...$(NC)"
	@if [ -f "test-extension.sh" ]; then \
		bash test-extension.sh; \
	else \
		echo "$(YELLOW)⚠ No test script found$(NC)"; \
	fi

# Clean build artifacts
clean:
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf release/
	@rm -f *.vsix
	@echo "$(GREEN)✓ Cleaned$(NC)"

# Lint code
lint:
	@echo "$(BLUE)Linting code...$(NC)"
	@npm run lint 2>/dev/null || echo "$(YELLOW)⚠ No lint script configured$(NC)"

# Full release workflow
all: clean build release

.DEFAULT_GOAL := help
