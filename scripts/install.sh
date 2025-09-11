#!/bin/bash

# IELTS Appointment Monitor - Installation Script for Linux/macOS
# This script installs the IELTS Appointment Monitor globally on your system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="ielts-appointment-monitor"
MIN_NODE_VERSION="16.0.0"
INSTALL_DIR="$HOME/.local/bin"

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              IELTS Appointment Monitor Installer             ║"
    echo "║                                                              ║"
    echo "║  This script will install the IELTS Appointment Monitor     ║"
    echo "║  globally on your system for easy command-line access.      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

version_compare() {
    # Compare version numbers (returns 0 if $1 >= $2)
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

check_node_version() {
    if ! check_command node; then
        print_error "Node.js is not installed. Please install Node.js >= $MIN_NODE_VERSION"
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
    
    local node_version=$(node --version | sed 's/v//')
    print_step "Found Node.js version: $node_version"
    
    if ! version_compare "$node_version" "$MIN_NODE_VERSION"; then
        print_error "Node.js version $node_version is too old. Required: >= $MIN_NODE_VERSION"
        echo "Please update Node.js from: https://nodejs.org/"
        exit 1
    fi
    
    print_success "Node.js version check passed"
}

check_npm() {
    if ! check_command npm; then
        print_error "npm is not installed. Please install npm"
        exit 1
    fi
    
    local npm_version=$(npm --version)
    print_step "Found npm version: $npm_version"
    print_success "npm check passed"
}

install_dependencies() {
    print_step "Installing dependencies..."
    
    if ! npm install; then
        print_error "Failed to install dependencies"
        exit 1
    fi
    
    print_success "Dependencies installed successfully"
}

build_application() {
    print_step "Building application..."
    
    if ! npm run build:prod; then
        print_error "Failed to build application"
        exit 1
    fi
    
    print_success "Application built successfully"
}

install_globally() {
    print_step "Installing globally..."
    
    # Try npm link first (preferred method)
    if npm link 2>/dev/null; then
        print_success "Installed globally using npm link"
        return 0
    fi
    
    print_warning "npm link failed, trying alternative installation..."
    
    # Alternative: manual installation
    mkdir -p "$INSTALL_DIR"
    
    # Create executable script
    cat > "$INSTALL_DIR/ielts-monitor" << 'EOF'
#!/usr/bin/env node
const path = require('path');
const appPath = path.join(__dirname, '..', 'share', 'ielts-appointment-monitor', 'dist', 'cli', 'index.js');
require(appPath);
EOF
    
    chmod +x "$INSTALL_DIR/ielts-monitor"
    
    # Copy application files
    local app_dir="$HOME/.local/share/$APP_NAME"
    mkdir -p "$app_dir"
    cp -r dist/ package.json "$app_dir/"
    
    print_success "Installed to $INSTALL_DIR/ielts-monitor"
    
    # Check if directory is in PATH
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        print_warning "$INSTALL_DIR is not in your PATH"
        echo "Add the following line to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo "export PATH=\"$INSTALL_DIR:\$PATH\""
    fi
}

test_installation() {
    print_step "Testing installation..."
    
    if check_command ielts-monitor; then
        local version=$(ielts-monitor --version 2>/dev/null || echo "unknown")
        print_success "Installation test passed - version: $version"
        return 0
    else
        print_error "Installation test failed - command not found"
        return 1
    fi
}

setup_directories() {
    print_step "Setting up application directories..."
    
    local config_dir="$HOME/.ielts-monitor"
    local log_dir="$config_dir/logs"
    local data_dir="$config_dir/data"
    
    mkdir -p "$config_dir" "$log_dir" "$data_dir"
    
    # Copy example configuration if it doesn't exist
    if [[ ! -f "$config_dir/config.json" && -f "config/monitor-config.example.json" ]]; then
        cp "config/monitor-config.example.json" "$config_dir/config.json"
        print_success "Created default configuration at $config_dir/config.json"
    fi
    
    print_success "Application directories set up"
}

cleanup_on_error() {
    print_error "Installation failed. Cleaning up..."
    
    # Remove global installation if it exists
    npm unlink 2>/dev/null || true
    rm -f "$INSTALL_DIR/ielts-monitor" 2>/dev/null || true
    rm -rf "$HOME/.local/share/$APP_NAME" 2>/dev/null || true
    
    exit 1
}

print_completion_message() {
    echo
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Installation Complete!                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo
    echo "🎉 IELTS Appointment Monitor has been installed successfully!"
    echo
    echo "📋 Next steps:"
    echo "  1. Configure your monitoring preferences:"
    echo "     ${BLUE}ielts-monitor configure${NC}"
    echo
    echo "  2. Start monitoring:"
    echo "     ${BLUE}ielts-monitor start${NC}"
    echo
    echo "  3. Check status:"
    echo "     ${BLUE}ielts-monitor status${NC}"
    echo
    echo "📚 For help and documentation:"
    echo "  • Run: ${BLUE}ielts-monitor --help${NC}"
    echo "  • View logs: ${BLUE}ielts-monitor logs${NC}"
    echo "  • Read docs: ${BLUE}cat docs/README.md${NC}"
    echo
    echo "🐛 Having issues? Check the troubleshooting guide:"
    echo "  ${BLUE}cat docs/TROUBLESHOOTING.md${NC}"
    echo
}

# Main installation process
main() {
    print_header
    
    # Set up error handling
    trap cleanup_on_error ERR
    
    # Pre-installation checks
    print_step "Performing pre-installation checks..."
    check_node_version
    check_npm
    
    # Installation steps
    install_dependencies
    build_application
    setup_directories
    install_globally
    
    # Post-installation verification
    if test_installation; then
        print_completion_message
    else
        print_error "Installation completed but verification failed"
        echo "Try running: ielts-monitor --help"
        exit 1
    fi
}

# Check if running as root (not recommended)
if [[ $EUID -eq 0 ]]; then
    print_warning "Running as root is not recommended"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled"
        exit 1
    fi
fi

# Run main installation
main "$@"