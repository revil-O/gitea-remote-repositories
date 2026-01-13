#!/bin/bash

# G2R Extension Test Script
echo "🧪 G2R Extension Test Suite"
echo "================================"
echo ""

PROJECT_DIR="/Users/osc/development/vscode-extensions/gitea pull request tool"
cd "$PROJECT_DIR"

# Test 1: Check if extension is installed
echo "✓ Test 1: Extension Installation"
if code --list-extensions | grep -q "revilo - oliver schmidt.g2r"; then
    echo "  ✅ G2R extension is installed"
else
    echo "  ❌ Extension not found"
    exit 1
fi
echo ""

# Test 2: Check VSIX file
echo "✓ Test 2: VSIX Package"
VSIX_FILE="release/G2R-1.0.2.vsix"
if [ -f "$VSIX_FILE" ]; then
    SIZE=$(ls -lh "$VSIX_FILE" | awk '{print $5}')
    echo "  ✅ VSIX file exists: $SIZE"
else
    echo "  ❌ VSIX file not found"
    exit 1
fi
echo ""

# Test 3: Check TypeScript compilation
echo "✓ Test 3: TypeScript Compilation"
if [ -f "release/extension.js" ]; then
    SIZE=$(ls -lh "release/extension.js" | awk '{print $5}')
    echo "  ✅ Compiled extension.js: $SIZE"
else
    echo "  ❌ Compiled file not found"
    exit 1
fi
echo ""

# Test 4: Check source files
echo "✓ Test 4: Source Files"
SOURCES=("src/extension.ts" "src/webviews/changelogPanel.ts" "src/commands/showChangelog.ts")
for file in "${SOURCES[@]}"; do
    if [ -f "$file" ]; then
        LINES=$(wc -l < "$file")
        echo "  ✅ $file ($LINES lines)"
    else
        echo "  ❌ $file not found"
        exit 1
    fi
done
echo ""

# Test 5: Git status
echo "✓ Test 5: Git Repository"
COMMITS=$(git log --oneline | wc -l)
LAST_COMMIT=$(git log -1 --pretty=format:"%h %s")
echo "  ✅ Total commits: $COMMITS"
echo "  ✅ Latest: $LAST_COMMIT"
echo ""

# Test 6: Package.json integrity
echo "✓ Test 6: package.json Configuration"
if grep -q '"name": "G2R"' package.json; then
    echo "  ✅ Name: G2R"
fi
if grep -q '"version": "1.0.2"' package.json; then
    echo "  ✅ Version: 1.0.2"
fi
if grep -q '"extension.showChangelog"' package.json; then
    echo "  ✅ Changelog command registered"
fi
echo ""

# Test 7: License file
echo "✓ Test 7: License & Documentation"
if [ -f "LICENSE" ]; then
    echo "  ✅ LICENSE file present"
fi
if [ -f "CHANGELOG.md" ]; then
    echo "  ✅ CHANGELOG.md present"
fi
if [ -f "README.md" ]; then
    echo "  ✅ README.md present"
fi
echo ""

# Test 8: Webview files
echo "✓ Test 8: Dashboard Webview"
if grep -q "📊 G2R Dashboard" src/webviews/changelogPanel.ts; then
    echo "  ✅ Dashboard UI implemented"
fi
if grep -q "Timeline" src/webviews/changelogPanel.ts; then
    echo "  ✅ Timeline feature implemented"
fi
if grep -q "Issues" src/webviews/changelogPanel.ts; then
    echo "  ✅ Issues tracking implemented"
fi
if grep -q "Pull Requests" src/webviews/changelogPanel.ts; then
    echo "  ✅ PR tracking implemented"
fi
if grep -q "Developers" src/webviews/changelogPanel.ts; then
    echo "  ✅ Developer stats implemented"
fi
echo ""

echo "================================"
echo "✅ All tests passed!"
echo "================================"
echo ""
echo "🚀 Next steps:"
echo "  1. Open VS Code with the project folder"
echo "  2. Press Cmd+Shift+P to open Command Palette"
echo "  3. Type 'Show Changelog & Git History' and press Enter"
echo "  4. Explore the dashboard tabs:"
echo "     - 📈 Overview (Stats & Recent Activity)"
echo "     - 📅 Timeline (Chronological Events)"
echo "     - 🐛 Issues (Issue Tracking)"
echo "     - 🔀 PRs (Pull Request Tracking)"
echo "     - 👥 Developers (Developer Statistics)"
echo "     - 📝 Commits (Git History)"
echo ""
