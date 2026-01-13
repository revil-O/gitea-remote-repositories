#!/bin/bash

# Script to automatically update version in README.md from package.json
# Run this as part of the build process

VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')

if [ -z "$VERSION" ]; then
  echo "Error: Could not extract version from package.json"
  exit 1
fi

# Update version in README.md using a simpler pattern
sed -i.bak "s/Version:** [0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*/Version:** $VERSION/" README.md

# Remove backup file
rm -f README.md.bak

echo "Updated README.md version to $VERSION"
