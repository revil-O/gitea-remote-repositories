#!/bin/bash

# ╔════════════════════════════════════════════════════════════════════════╗
# ║              Batch Release Creator - Create All Releases               ║
# ║                    mit VSIX Upload für alle Tags                       ║
# ╚════════════════════════════════════════════════════════════════════════╝

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/gitea.conf"

# Load config from gitea.conf if exists
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    export GITEA_TOKEN="$token"
    BASE_URL="${base_url}"
else
    BASE_URL="10.10.0.254:3002"
fi

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

print_step() {
    echo -e "${CYAN}→${NC} $1"
}

# Get Gitea Token
get_gitea_token() {
    if [ -z "$GITEA_TOKEN" ]; then
        print_error "GITEA_TOKEN not set"
        echo ""
        echo "Optionen:"
        echo "  1. Token in gitea.conf speichern: token=\"...\""
        echo "  2. Oder: export GITEA_TOKEN=<token>"
        return 1
    fi
    echo "$GITEA_TOKEN"
}

# Check if release exists
release_exists() {
    local version="$1"
    local token="$2"
    
    local response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: token $token" \
        "http://10.10.0.254:3002/api/v1/repos/revilo/Gitea-remote-repositories/releases/tags/${version}")
    
    local http_code=$(echo "$response" | tail -1)
    [ "$http_code" = "200" ]
}

# Create release
create_release() {
    local version="$1"
    local vsix_file="$2"
    local token="$3"
    local notes_file="$4"
    
    # Read release notes
    local notes=""
    if [ -f "$notes_file" ]; then
        notes=$(cat "$notes_file" | head -100)
    else
        notes="Release $version"
    fi
    
    # Escape special characters
    notes=$(echo "$notes" | jq -Rs .)
    
    # Create release via API
    local response=$(curl -s -X POST \
        -H "Authorization: token $token" \
        -H "Content-Type: application/json" \
        "http://${BASE_URL}/api/v1/repos/revilo/Gitea-remote-repositories/releases" \
        -d "{
            \"tag_name\": \"$version\",
            \"name\": \"G2R $version\",
            \"body\": $notes,
            \"draft\": false,
            \"prerelease\": false
        }")
    
    # Check response
    if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
        print_success "Release created: $version"
        return 0
    else
        print_warning "Release might already exist: $version"
        return 1
    fi
}

# Upload VSIX to release
upload_vsix_to_release() {
    local version="$1"
    local vsix_file="$2"
    local token="$3"
    
    if [ ! -f "$vsix_file" ]; then
        print_error "VSIX file not found: $vsix_file"
        return 1
    fi
    
    # Get release ID
    local release_id=$(curl -s \
        -H "Authorization: token $token" \
        "http://${BASE_URL}/api/v1/repos/revilo/Gitea-remote-repositories/releases/tags/${version}" \
        | jq -r '.id')
    
    if [ -z "$release_id" ] || [ "$release_id" = "null" ]; then
        print_error "Could not get release ID for $version"
        return 1
    fi
    
    # Upload file
    local response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: token $token" \
        -F "attachment=@${vsix_file}" \
        "http://${BASE_URL}/api/v1/repos/revilo/Gitea-remote-repositories/releases/${release_id}/assets")
    
    local http_code=$(echo "$response" | tail -1)
    
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        print_success "VSIX uploaded: $(basename $vsix_file)"
        return 0
    else
        print_error "Failed to upload VSIX: HTTP $http_code"
        return 1
    fi
}

# Main logic
main() {
    print_header "Batch Release Creator"
    
    # Get token
    TOKEN=$(get_gitea_token)
    
    # Get all git tags
    TAGS=($(git tag -l | sort -V))
    
    if [ ${#TAGS[@]} -eq 0 ]; then
        print_error "No git tags found"
        exit 1
    fi
    
    print_info "Found ${#TAGS[@]} tags to process"
    echo ""
    
    # Process each tag
    local created_count=0
    local uploaded_count=0
    
    for tag in "${TAGS[@]}"; do
        print_step "Processing $tag"
        
        # Extract version number
        local version_num=${tag#v}
        local vsix_file="$SCRIPT_DIR/release/G2R-${version_num}.vsix"
        local notes_file="$SCRIPT_DIR/RELEASE_v${version_num}.md"
        
        # Check if release already exists
        if release_exists "$tag" "$TOKEN"; then
            print_warning "Release already exists: $tag"
        else
            # Create release
            if create_release "$tag" "$vsix_file" "$TOKEN" "$notes_file"; then
                ((created_count++))
            else
                print_warning "Could not create release: $tag"
            fi
        fi
        
        # Upload VSIX if exists
        if [ -f "$vsix_file" ]; then
            if upload_vsix_to_release "$tag" "$vsix_file" "$TOKEN"; then
                ((uploaded_count++))
            else
                print_warning "Could not upload VSIX for $tag"
            fi
        else
            print_warning "VSIX not found: $vsix_file"
        fi
        
        echo ""
    done
    
    # Summary
    print_header "Batch Processing Complete"
    
    echo "Results:"
    echo "  Tags processed: ${#TAGS[@]}"
    echo "  Releases created: $created_count"
    echo "  VSIX files uploaded: $uploaded_count"
    echo ""
    
    print_success "All releases are now available at:"
    echo "  http://10.10.0.254:3002/revilo/Gitea-remote-repositories/releases"
}

# Run
main "$@"
