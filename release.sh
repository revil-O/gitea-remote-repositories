#!/bin/bash

###############################################################################
#
# G2R Release Manager - Gitea VSIX Upload
# Version: 1.0.0
# Purpose: Automatically upload VSIX files to Gitea releases
#
# Usage:
#   ./release.sh              - Create release from latest tag
#   ./release.sh v1.0.3       - Create release for specific version
#   ./release.sh --help       - Show help
#
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="revilo"
REPO_NAME="Gitea-remote-repositories"
GITEA_URL="http://10.10.0.254:3002"
REPO_API="${GITEA_URL}/api/v1/repos/${REPO_OWNER}/${REPO_NAME}"

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="$SCRIPT_DIR"

###############################################################################
# Functions
###############################################################################

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
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

show_help() {
    cat << EOF
${BLUE}G2R Release Manager${NC}

${YELLOW}Usage:${NC}
    ./release.sh [VERSION] [OPTIONS]

${YELLOW}Arguments:${NC}
    VERSION              Version tag (e.g., v1.0.3). Default: latest tag
    --help               Show this help message
    --dry-run            Show what would be done without executing
    --force              Force upload even if release exists

${YELLOW}Examples:${NC}
    ./release.sh                    # Use latest tag
    ./release.sh v1.0.3             # Create release for v1.0.3
    ./release.sh v1.0.3 --dry-run   # Preview release creation
    ./release.sh v1.0.3 --force     # Force update existing release

${YELLOW}Environment Variables:${NC}
    GITEA_TOKEN          API token for Gitea (optional, uses git credentials if not set)
    GITEA_URL            Gitea server URL (default: http://10.10.0.254:3002)

${YELLOW}Files:${NC}
    G2R-VERSION.vsix  VSIX package file (must exist)
    CHANGELOG.md         Release notes source
    RELEASE_vVERSION.md  Detailed release notes

${YELLOW}Output:${NC}
    - VSIX file uploaded to Gitea release
    - Release created with changelog
    - Git tag verified
    - Assets confirmed in Gitea

EOF
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get version from various sources
get_version() {
    local version="$1"
    
    if [ -z "$version" ]; then
        # Try to get latest tag
        if command_exists git; then
            version=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
        fi
    fi
    
    if [ -z "$version" ]; then
        # Fall back to package.json
        if [ -f "package.json" ]; then
            version="v$(grep '"version"' package.json | head -1 | sed 's/.*"\([^"]*\)".*/\1/')"
        fi
    fi
    
    echo "$version"
}

# Extract version number without 'v'
get_version_number() {
    echo "$1" | sed 's/^v//'
}

# Check if VSIX file exists
check_vsix_exists() {
    local version="$1"
    local vsix_file="$WORK_DIR/release/G2R-${version}.vsix"
    
    if [ ! -f "$vsix_file" ]; then
        print_error "VSIX file not found: $vsix_file"
        return 1
    fi
    
    print_success "VSIX file found: $(basename "$vsix_file")"
    echo "$vsix_file"
    return 0
}

# Get Gitea API token
get_gitea_token() {
    if [ -n "$GITEA_TOKEN" ]; then
        echo "$GITEA_TOKEN"
        return 0
    fi
    
    # Try to get from git credentials
    local token=$(git credential fill <<< "host=$GITEA_URL" | grep password | cut -d= -f2)
    if [ -n "$token" ]; then
        echo "$token"
        return 0
    fi
    
    print_warning "No GITEA_TOKEN found. API calls may fail."
    return 1
}

# Create release in Gitea
create_release() {
    local version="$1"
    local vsix_file="$2"
    local token="$3"
    local dry_run="$4"
    
    print_info "Creating release: $version"
    
    # Get release notes
    local notes=""
    local notes_file="$WORK_DIR/RELEASE_${version}.md"
    
    if [ -f "$notes_file" ]; then
        notes=$(cat "$notes_file")
        print_success "Using detailed release notes from $notes_file"
    elif [ -f "$WORK_DIR/CHANGELOG.md" ]; then
        notes=$(sed -n "/## \[${version#v}\]/,/## \[/p" "$WORK_DIR/CHANGELOG.md" | head -n -1)
        if [ -z "$notes" ]; then
            notes="See CHANGELOG.md for details"
        fi
        print_success "Using changelog from CHANGELOG.md"
    else
        notes="Release $version"
    fi
    
    # Create JSON payload
    local payload=$(cat <<EOF
{
    "tag_name": "$version",
    "name": "G2R $version",
    "body": "$(echo "$notes" | jq -Rs .)",
    "draft": false,
    "prerelease": false
}
EOF
)
    
    if [ "$dry_run" = "true" ]; then
        print_info "DRY RUN - Would create release with:"
        echo "  Tag: $version"
        echo "  Name: G2R $version"
        echo "  VSIX: $(basename "$vsix_file")"
        echo "  Size: $(du -h "$vsix_file" | cut -f1)"
        echo ""
        echo "  Payload:"
        echo "$payload" | jq . 2>/dev/null || echo "$payload"
        return 0
    fi
    
    # Check if release already exists
    print_info "Checking if release exists..."
    local exists=$(curl -s -w "\n%{http_code}" -H "Authorization: token $token" \
        "${REPO_API}/releases/tags/${version}" 2>/dev/null | tail -1)
    
    if [ "$exists" = "200" ]; then
        print_warning "Release $version already exists"
        if [ "$FORCE_UPLOAD" != "true" ]; then
            print_error "Use --force to overwrite existing release"
            return 1
        fi
    fi
    
    # Create release
    print_info "Uploading to Gitea..."
    local response=$(curl -s -X POST \
        -H "Authorization: token $token" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "${REPO_API}/releases")
    
    # Check response
    if echo "$response" | grep -q "tag_name"; then
        print_success "Release created successfully"
    else
        print_error "Failed to create release"
        echo "$response" | jq . 2>/dev/null || echo "$response"
        return 1
    fi
    
    return 0
}

# Upload VSIX as asset
upload_vsix_asset() {
    local version="$1"
    local vsix_file="$2"
    local token="$3"
    local dry_run="$4"
    
    if [ "$dry_run" = "true" ]; then
        print_info "DRY RUN - Would upload VSIX file"
        return 0
    fi
    
    print_info "Uploading VSIX file as release asset..."
    
    # Get release ID
    local release_id=$(curl -s -H "Authorization: token $token" \
        "${REPO_API}/releases/tags/${version}" | jq -r '.id')
    
    if [ -z "$release_id" ] || [ "$release_id" = "null" ]; then
        print_error "Could not get release ID"
        return 1
    fi
    
    # Upload file
    local response=$(curl -s -X POST \
        -H "Authorization: token $token" \
        -F "attachment=@${vsix_file}" \
        "${REPO_API}/releases/${release_id}/assets")
    
    if echo "$response" | grep -q "name"; then
        print_success "VSIX uploaded: $(basename "$vsix_file")"
        echo "$response" | jq -r '.name, .browser_download_url' 2>/dev/null
    else
        print_warning "VSIX upload status unclear"
        echo "$response" | jq . 2>/dev/null || echo "$response"
    fi
    
    return 0
}

# Build VSIX if needed
build_vsix() {
    local version="$1"
    local vsix_file="$WORK_DIR/release/G2R-${version}.vsix"
    
    if [ -f "$vsix_file" ]; then
        print_success "VSIX already built: $(basename "$vsix_file")"
        return 0
    fi
    
    print_info "Building VSIX package..."
    
    if [ ! -f "$WORK_DIR/package.json" ]; then
        print_error "package.json not found"
        return 1
    fi
    
    # Check if npm is available
    if ! command_exists npm; then
        print_error "npm is not installed"
        return 1
    fi
    
    # Run build
    if npm run compile 2>&1 | tail -3; then
        npx vsce package --no-dependencies --baseContentUrl "http://10.10.0.254:3002/revilo/Gitea-remote-repositories/raw/branch/master" -o release/ 2>&1 | tail -2
        
        if [ -f "$vsix_file" ]; then
            print_success "VSIX built: $(basename "$vsix_file") ($(du -h "$vsix_file" | cut -f1))"
            return 0
        fi
    fi
    
    print_error "Failed to build VSIX"
    return 1
}

# Verify git tag exists
verify_git_tag() {
    local version="$1"
    
    if command_exists git; then
        if git rev-parse "$version" >/dev/null 2>&1; then
            print_success "Git tag verified: $version"
            return 0
        else
            print_warning "Git tag not found: $version"
            print_info "Creating git tag..."
            git tag -a "$version" -m "Release $version" 2>/dev/null || true
        fi
    fi
}

###############################################################################
# Main
###############################################################################

main() {
    local version=""
    local dry_run="false"
    local build="true"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                show_help
                exit 0
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            --force)
                FORCE_UPLOAD="true"
                shift
                ;;
            --no-build)
                build="false"
                shift
                ;;
            v[0-9]*)
                version="$1"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_header "G2R Release Manager"
    
    # Get version
    version=$(get_version "$version")
    if [ -z "$version" ]; then
        print_error "Could not determine version"
        exit 1
    fi
    
    version_num=$(get_version_number "$version")
    
    print_info "Version: $version"
    print_info "Repository: ${REPO_OWNER}/${REPO_NAME}"
    
    if [ "$dry_run" = "true" ]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi
    
    # Build VSIX if needed
    if [ "$build" = "true" ]; then
        build_vsix "$version_num"
    fi
    
    # Verify VSIX exists
    vsix_file=$(check_vsix_exists "$version_num") || exit 1
    
    # Verify git tag
    verify_git_tag "$version"
    
    # Get token
    token=$(get_gitea_token)
    if [ -z "$token" ]; then
        print_warning "Continuing without authentication (limited access)"
    fi
    
    # Create release
    if create_release "$version" "$vsix_file" "$token" "$dry_run"; then
        # Upload VSIX asset
        if upload_vsix_asset "$version" "$vsix_file" "$token" "$dry_run"; then
            if [ "$dry_run" = "false" ]; then
                print_header "Release Created Successfully! ✓"
                print_info "Release URL: ${GITEA_URL}/${REPO_OWNER}/${REPO_NAME}/releases/tag/${version}"
                print_info "Download: ${GITEA_URL}/${REPO_OWNER}/${REPO_NAME}/releases/download/${version}/G2R-${version_num}.vsix"
            fi
            exit 0
        fi
    fi
    
    print_error "Release creation failed"
    exit 1
}

# Run main function
main "$@"
