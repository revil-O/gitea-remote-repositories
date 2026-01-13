#!/bin/bash

# ╔════════════════════════════════════════════════════════════════════════╗
# ║                   Version Sync Tool - SPOT Manager                     ║
# ║                  Single Point Of Truth for Versioning                  ║
# ╚════════════════════════════════════════════════════════════════════════╝

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/VERSION"

# Functions
print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Get current version from VERSION file
get_current_version() {
    if [ ! -f "$VERSION_FILE" ]; then
        print_error "VERSION file not found at $VERSION_FILE"
        exit 1
    fi
    cat "$VERSION_FILE" | tr -d '[:space:]'
}

# Validate version format
validate_version() {
    local version="$1"
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_error "Invalid version format: $version (expected: X.Y.Z)"
        return 1
    fi
    return 0
}

# Show current version
show_version() {
    local current=$(get_current_version)
    print_info "Current version from SPOT: ${GREEN}$current${NC}"
}

# List all files containing version
list_version_files() {
    print_header "Files Containing Version Information"
    
    local files=(
        "package.json"
        ".vsixmanifest"
        "src/extension.ts"
        "src/commands/showChangelog.ts"
        "src/fs/giteaFileSystemProvider.ts"
        "src/commands/remoteRepo.ts"
        "src/giteaApi/client.ts"
        "src/config/settings.ts"
        "src/auth/authManager.ts"
        "src/tree/issueTreeProvider.ts"
        "src/tree/branchTreeProvider.ts"
        "src/tree/repositoryTreeProvider.ts"
        "src/webviews/changelogPanel.ts"
        "TEST_REPORT.md"
        "QUICKSTART.md"
        "RESPONSIVE_DESIGN.md"
        "RESPONSIVE_SHOWCASE.md"
        "RELEASE_v1.0.3.md"
        "RELEASE_v1.0.2.md"
        "RELEASE_v1.0.1.md"
        "IMPLEMENTATION_CHECKLIST.md"
        "release.sh"
        "test-extension.sh"
    )
    
    local current=$(get_current_version)
    
    echo "Files to be synchronized:"
    echo ""
    
    for file in "${files[@]}"; do
        if [ -f "$SCRIPT_DIR/$file" ]; then
            local count=$(grep -c "1\.0\.[0-9]\|v1\.0\.[0-9]" "$SCRIPT_DIR/$file" 2>/dev/null || echo "0")
            if [ "$count" -gt 0 ]; then
                echo "  • $file ($count occurrences)"
            fi
        fi
    done
}

# Update version in all files
update_all_versions() {
    local new_version="$1"
    local current=$(get_current_version)
    
    if [ "$current" == "$new_version" ]; then
        print_warning "Version is already $new_version, nothing to update"
        return 0
    fi
    
    print_header "Updating Versions: $current → $new_version"
    
    local files=(
        "package.json"
        ".vsixmanifest"
        "src/extension.ts"
        "src/commands/showChangelog.ts"
        "src/fs/giteaFileSystemProvider.ts"
        "src/commands/remoteRepo.ts"
        "src/giteaApi/client.ts"
        "src/config/settings.ts"
        "src/auth/authManager.ts"
        "src/tree/issueTreeProvider.ts"
        "src/tree/branchTreeProvider.ts"
        "src/tree/repositoryTreeProvider.ts"
        "src/webviews/changelogPanel.ts"
        "TEST_REPORT.md"
        "QUICKSTART.md"
        "RESPONSIVE_DESIGN.md"
        "RESPONSIVE_SHOWCASE.md"
        "RELEASE_v1.0.3.md"
        "IMPLEMENTATION_CHECKLIST.md"
        "release.sh"
        "test-extension.sh"
    )
    
    local updated_count=0
    
    for file in "${files[@]}"; do
        if [ ! -f "$SCRIPT_DIR/$file" ]; then
            continue
        fi
        
        # Create backup
        cp "$SCRIPT_DIR/$file" "$SCRIPT_DIR/$file.bak"
        
        # Update all version patterns
        sed -i.tmp \
            -e "s/v${current}/v${new_version}/g" \
            -e "s/${current}/${new_version}/g" \
            "$SCRIPT_DIR/$file"
        
        rm -f "$SCRIPT_DIR/$file.tmp"
        
        # Check if changes were made
        if ! cmp -s "$SCRIPT_DIR/$file" "$SCRIPT_DIR/$file.bak"; then
            print_success "Updated: $file"
            rm -f "$SCRIPT_DIR/$file.bak"
            ((updated_count++))
        else
            # Restore if no changes
            mv "$SCRIPT_DIR/$file.bak" "$SCRIPT_DIR/$file"
        fi
    done
    
    # Update VERSION file (SPOT)
    echo "$new_version" > "$VERSION_FILE"
    print_success "Updated: VERSION (SPOT)"
    
    print_info "Total files updated: $updated_count"
}

# Main logic
print_header "G2R Version SPOT Manager"

case "${1:-show}" in
    show)
        show_version
        list_version_files
        ;;
    
    list)
        list_version_files
        ;;
    
    update)
        if [ -z "$2" ]; then
            print_error "Usage: $0 update <version>"
            echo ""
            echo "Examples:"
            echo "  $0 update 1.0.4"
            echo "  $0 update 1.0.5"
            exit 1
        fi
        
        validate_version "$2" || exit 1
        
        # Confirmation
        current=$(get_current_version)
        echo ""
        echo -e "  Current version: ${YELLOW}$current${NC}"
        echo -e "  New version:     ${GREEN}$2${NC}"
        echo ""
        read -p "  Continue? (y/n) " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            update_all_versions "$2"
            echo ""
            print_success "All versions updated!"
            echo ""
            echo "Next steps:"
            echo "  1. Review changes with: git diff"
            echo "  2. Test the build: npm run compile"
            echo "  3. Commit changes: git add -A && git commit -m 'chore: Bump version to $2'"
            echo "  4. Create release: make release"
        else
            print_warning "Update cancelled"
            exit 1
        fi
        ;;
    
    verify)
        print_header "Verifying Version Consistency"
        
        current=$(get_current_version)
        files=(
            "package.json"
            ".vsixmanifest"
            "src/extension.ts"
        )
        
        echo "SPOT Version: ${GREEN}$current${NC}"
        echo ""
        
        all_match=true
        for file in "${files[@]}"; do
            if [ -f "$SCRIPT_DIR/$file" ]; then
                if grep -q "$current" "$SCRIPT_DIR/$file"; then
                    print_success "$file"
                else
                    print_error "$file (contains different version)"
                    all_match=false
                fi
            fi
        done
        
        echo ""
        if [ "$all_match" = true ]; then
            print_success "All versions consistent!"
            exit 0
        else
            print_error "Version inconsistencies detected"
            exit 1
        fi
        ;;
    
    --help|-h)
        cat << 'HELP'

G2R Version SPOT Manager - Single Point Of Truth Versioning

USAGE:
  ./update-version.sh [COMMAND] [OPTIONS]

COMMANDS:
  show           Show current version and list all version-containing files
  list           List all files containing version information
  update <VER>   Update all files to new version (e.g., 1.0.4)
  verify         Check version consistency across all critical files
  --help         Show this help message

EXAMPLES:
  ./update-version.sh show              # Show current version
  ./update-version.sh update 1.0.4      # Bump version to 1.0.4
  ./update-version.sh verify            # Check consistency

HOW IT WORKS:
  1. VERSION file is the Single Point Of Truth (SPOT)
  2. update command synchronizes all project files
  3. Changes are made with confirmation prompt
  4. Backups are created before updates
  5. Verification ensures consistency

WORKFLOW:
  1. Update version: ./update-version.sh update 1.0.4
  2. Review changes: git diff
  3. Commit changes: git add -A && git commit -m "chore: Bump to 1.0.4"
  4. Create release: make release
  5. Verify: ./update-version.sh verify

SPOT RULE:
  Always use VERSION file as the single source of truth.
  All other files are synchronized from this master file.

HELP
        ;;
    
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 --help' for usage information"
        exit 1
        ;;
esac
