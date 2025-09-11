#!/bin/bash

# IELTS Appointment Monitor - Packaging Script
# Creates distributable packages for different platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="ielts-appointment-monitor"
VERSION=$(node -p "require('./package.json').version")
BUILD_DIR="build"
DIST_DIR="dist"

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              IELTS Appointment Monitor Packager             ║"
    echo "║                                                              ║"
    echo "║  Creating distributable packages for multiple platforms     ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cleanup() {
    print_step "Cleaning up previous builds..."
    rm -rf "$BUILD_DIR"
    npm run clean
}

build_application() {
    print_step "Building application for production..."
    npm run build:prod
    print_success "Application built successfully"
}

create_build_directory() {
    print_step "Creating build directory structure..."
    mkdir -p "$BUILD_DIR"/{linux,macos,windows,universal}
    print_success "Build directory created"
}

package_universal() {
    print_step "Creating universal npm package..."
    
    local package_dir="$BUILD_DIR/universal"
    
    # Copy essential files
    cp -r "$DIST_DIR" "$package_dir/"
    cp package.json "$package_dir/"
    cp README.md "$package_dir/"
    cp -r docs/ "$package_dir/"
    cp -r config/ "$package_dir/"
    
    # Create package
    cd "$package_dir"
    npm pack
    mv *.tgz "../${APP_NAME}-${VERSION}-universal.tgz"
    cd - > /dev/null
    
    print_success "Universal package created: ${APP_NAME}-${VERSION}-universal.tgz"
}

package_linux() {
    print_step "Creating Linux package..."
    
    local package_dir="$BUILD_DIR/linux"
    local app_dir="$package_dir/${APP_NAME}"
    
    # Create directory structure
    mkdir -p "$app_dir"/{bin,lib,share,doc}
    
    # Copy application files
    cp -r "$DIST_DIR" "$app_dir/lib/"
    cp package.json "$app_dir/lib/"
    cp -r docs/ "$app_dir/doc/"
    cp -r config/ "$app_dir/share/"
    
    # Create executable wrapper
    cat > "$app_dir/bin/ielts-monitor" << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
node "$DIR/../lib/dist/cli/index.js" "$@"
EOF
    chmod +x "$app_dir/bin/ielts-monitor"
    
    # Create installation script
    cp scripts/install.sh "$app_dir/"
    cp scripts/uninstall.sh "$app_dir/"
    
    # Create README for package
    cat > "$app_dir/README.txt" << EOF
IELTS Appointment Monitor - Linux Package

Installation:
1. Extract this package to your desired location
2. Run: ./install.sh
   OR
   Add the bin/ directory to your PATH

Usage:
./bin/ielts-monitor --help

Documentation:
See doc/ directory for complete documentation
EOF
    
    # Create tarball
    cd "$BUILD_DIR"
    tar -czf "${APP_NAME}-${VERSION}-linux.tar.gz" linux/
    cd - > /dev/null
    
    print_success "Linux package created: ${APP_NAME}-${VERSION}-linux.tar.gz"
}

package_macos() {
    print_step "Creating macOS package..."
    
    local package_dir="$BUILD_DIR/macos"
    local app_dir="$package_dir/${APP_NAME}"
    
    # Create directory structure
    mkdir -p "$app_dir"/{bin,lib,share,doc}
    
    # Copy application files
    cp -r "$DIST_DIR" "$app_dir/lib/"
    cp package.json "$app_dir/lib/"
    cp -r docs/ "$app_dir/doc/"
    cp -r config/ "$app_dir/share/"
    
    # Create executable wrapper
    cat > "$app_dir/bin/ielts-monitor" << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
node "$DIR/../lib/dist/cli/index.js" "$@"
EOF
    chmod +x "$app_dir/bin/ielts-monitor"
    
    # Create installation script
    cp scripts/install.sh "$app_dir/"
    cp scripts/uninstall.sh "$app_dir/"
    
    # Create README for package
    cat > "$app_dir/README.txt" << EOF
IELTS Appointment Monitor - macOS Package

Installation:
1. Extract this package to your desired location
2. Run: ./install.sh
   OR
   Add the bin/ directory to your PATH

Usage:
./bin/ielts-monitor --help

Documentation:
See doc/ directory for complete documentation

Note: You may need to allow the application in System Preferences > Security & Privacy
EOF
    
    # Create tarball
    cd "$BUILD_DIR"
    tar -czf "${APP_NAME}-${VERSION}-macos.tar.gz" macos/
    cd - > /dev/null
    
    print_success "macOS package created: ${APP_NAME}-${VERSION}-macos.tar.gz"
}

package_windows() {
    print_step "Creating Windows package..."
    
    local package_dir="$BUILD_DIR/windows"
    local app_dir="$package_dir/${APP_NAME}"
    
    # Create directory structure
    mkdir -p "$app_dir"/{bin,lib,share,doc}
    
    # Copy application files
    cp -r "$DIST_DIR" "$app_dir/lib/"
    cp package.json "$app_dir/lib/"
    cp -r docs/ "$app_dir/doc/"
    cp -r config/ "$app_dir/share/"
    
    # Create batch file wrapper
    cat > "$app_dir/bin/ielts-monitor.bat" << 'EOF'
@echo off
set DIR=%~dp0
node "%DIR%..\lib\dist\cli\index.js" %*
EOF
    
    # Create PowerShell wrapper
    cat > "$app_dir/bin/ielts-monitor.ps1" << 'EOF'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = Join-Path $scriptDir "..\lib\dist\cli\index.js"
& node $nodePath $args
EOF
    
    # Create installation script
    cp scripts/install.bat "$app_dir/"
    
    # Create README for package
    cat > "$app_dir/README.txt" << EOF
IELTS Appointment Monitor - Windows Package

Installation:
1. Extract this package to your desired location
2. Run: install.bat (as Administrator)
   OR
   Add the bin\ directory to your PATH

Usage:
bin\ielts-monitor.bat --help

Documentation:
See doc\ directory for complete documentation

Requirements:
- Node.js 16.0.0 or higher must be installed
- Windows 10 or higher
EOF
    
    # Create zip file
    cd "$BUILD_DIR"
    if command -v zip >/dev/null 2>&1; then
        zip -r "${APP_NAME}-${VERSION}-windows.zip" windows/
    else
        print_error "zip command not found, creating tar.gz instead"
        tar -czf "${APP_NAME}-${VERSION}-windows.tar.gz" windows/
    fi
    cd - > /dev/null
    
    print_success "Windows package created: ${APP_NAME}-${VERSION}-windows.zip"
}

create_checksums() {
    print_step "Creating checksums..."
    
    cd "$BUILD_DIR"
    
    # Create checksums file
    {
        echo "# IELTS Appointment Monitor v${VERSION} - Package Checksums"
        echo "# Generated on $(date)"
        echo ""
        
        for file in *.{tgz,tar.gz,zip} 2>/dev/null; do
            if [[ -f "$file" ]]; then
                if command -v sha256sum >/dev/null 2>&1; then
                    sha256sum "$file"
                elif command -v shasum >/dev/null 2>&1; then
                    shasum -a 256 "$file"
                else
                    echo "# Checksum not available for $file"
                fi
            fi
        done
    } > "checksums.txt"
    
    cd - > /dev/null
    
    print_success "Checksums created"
}

create_release_notes() {
    print_step "Creating release notes..."
    
    cat > "$BUILD_DIR/RELEASE_NOTES.md" << EOF
# IELTS Appointment Monitor v${VERSION}

## Package Contents

This release includes the following packages:

### Universal Package
- \`${APP_NAME}-${VERSION}-universal.tgz\` - NPM package for all platforms

### Platform-Specific Packages
- \`${APP_NAME}-${VERSION}-linux.tar.gz\` - Linux package with installer
- \`${APP_NAME}-${VERSION}-macos.tar.gz\` - macOS package with installer  
- \`${APP_NAME}-${VERSION}-windows.zip\` - Windows package with installer

## Installation

### Quick Install (Recommended)
\`\`\`bash
# Download and install universal package
npm install -g ${APP_NAME}-${VERSION}-universal.tgz
\`\`\`

### Platform-Specific Install
1. Download the appropriate package for your platform
2. Extract the package
3. Run the included installation script

## Verification

All packages include SHA256 checksums in \`checksums.txt\`.

## Documentation

Each package includes complete documentation:
- User Manual
- CLI Usage Guide  
- Configuration Examples
- Troubleshooting Guide
- Developer Guide

## Support

For issues or questions:
1. Check the included troubleshooting guide
2. Review the documentation
3. Create an issue in the repository

---

**Generated on $(date)**
EOF
    
    print_success "Release notes created"
}

print_summary() {
    echo
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Packaging Complete!                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo
    echo "📦 Created packages:"
    
    cd "$BUILD_DIR"
    for file in *.{tgz,tar.gz,zip} 2>/dev/null; do
        if [[ -f "$file" ]]; then
            local size=$(du -h "$file" | cut -f1)
            echo "  • $file ($size)"
        fi
    done
    cd - > /dev/null
    
    echo
    echo "📋 Additional files:"
    echo "  • checksums.txt - Package verification"
    echo "  • RELEASE_NOTES.md - Release information"
    echo
    echo "📁 All packages are in the '$BUILD_DIR' directory"
    echo
    echo "🚀 Ready for distribution!"
}

# Main packaging process
main() {
    print_header
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found. Please run from project root."
        exit 1
    fi
    
    # Packaging steps
    cleanup
    build_application
    create_build_directory
    
    # Create packages
    package_universal
    package_linux
    package_macos  
    package_windows
    
    # Finalize
    create_checksums
    create_release_notes
    
    print_summary
}

# Run main packaging
main "$@"