#!/bin/bash

# ╔════════════════════════════════════════════════════════════════════════╗
# ║          Quick Release Fixer - Create Releases with VSIX Upload       ║
# ║                    für alle existierenden Tags                         ║
# ╚════════════════════════════════════════════════════════════════════════╝

set -e

WORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$WORK_DIR/gitea.conf"

# Load config from gitea.conf
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    REPO="revilo/Gitea-remote-repositories"
    API_URL="http://${base_url}/api/v1/repos/$REPO"
    GITEA_TOKEN="$token"
else
    # Fallback to environment or interactive input
    REPO="revilo/Gitea-remote-repositories"
    API_URL="http://10.10.0.254:3002/api/v1/repos/$REPO"
fi

# Check token
if [ -z "$GITEA_TOKEN" ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  Gitea Token erforderlich                                  ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Optionen:"
    echo "  1. Token in gitea.conf speichern"
    echo "  2. Oder mit: export GITEA_TOKEN=<token>"
    echo ""
    echo "Token eingeben (wird nicht angezeigt):"
    read -sp "GITEA_TOKEN: " GITEA_TOKEN
    echo ""
    
    if [ -z "$GITEA_TOKEN" ]; then
        echo "❌ Token ist erforderlich!"
        exit 1
    fi
fi

echo "✓ GITEA_TOKEN is set"
echo ""

# Get all tags
TAGS=($(cd "$WORK_DIR" && git tag -l | sort -V))

echo "Found ${#TAGS[@]} tags:"
for tag in "${TAGS[@]}"; do
    echo "  • $tag"
done
echo ""

# For each tag
for tag in "${TAGS[@]}"; do
    version=${tag#v}
    vsix_file="$WORK_DIR/release/G2R-${version}.vsix"
    notes_file="$WORK_DIR/RELEASE_v${version}.md"
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Processing: $tag"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check if release exists
    echo "Checking if release exists..."
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: token $GITEA_TOKEN" \
        "$API_URL/releases/tags/$tag")
    
    if [ "$response" = "200" ]; then
        echo "  ℹ Release already exists"
    else
        echo "  Creating release..."
        
        # Read notes
        notes="Release $tag"
        if [ -f "$notes_file" ]; then
            notes=$(cat "$notes_file" | head -50 | jq -Rs . 2>/dev/null || echo "Release $tag" | jq -Rs .)
        else
            notes=$(echo "Release $tag" | jq -Rs .)
        fi
        
        # Create release
        curl -s -X POST \
            -H "Authorization: token $GITEA_TOKEN" \
            -H "Content-Type: application/json" \
            "$API_URL/releases" \
            -d "{
                \"tag_name\": \"$tag\",
                \"name\": \"G2R $tag\",
                \"body\": $notes,
                \"draft\": false,
                \"prerelease\": false
            }" > /dev/null
        
        echo "  ✓ Release created"
    fi
    
    # Upload VSIX if exists
    if [ -f "$vsix_file" ]; then
        echo "  Uploading VSIX..."
        
        # Get release ID
        release_id=$(curl -s \
            -H "Authorization: token $GITEA_TOKEN" \
            "$API_URL/releases/tags/$tag" | jq -r '.id // empty')
        
        if [ -z "$release_id" ]; then
            echo "  ❌ Could not get release ID"
            continue
        fi
        
        # Check if asset already exists
        asset_exists=$(curl -s \
            -H "Authorization: token $GITEA_TOKEN" \
            "$API_URL/releases/$release_id/assets" | \
            jq "[.[] | select(.name | endswith(\"$version.vsix\"))] | length" 2>/dev/null || echo "0")
        
        if [ "$asset_exists" -gt 0 ]; then
            echo "  ℹ VSIX already uploaded"
        else
            # Upload
            curl -s -X POST \
                -H "Authorization: token $GITEA_TOKEN" \
                -F "attachment=@$vsix_file" \
                "$API_URL/releases/$release_id/assets" > /dev/null
            
            echo "  ✓ VSIX uploaded: $(basename $vsix_file)"
        fi
    else
        echo "  ⚠ VSIX not found: $vsix_file"
    fi
    
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ All releases processed!"
echo ""
echo "Releases available at:"
echo "  http://10.10.0.254:3002/$REPO/releases"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
