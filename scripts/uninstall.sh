#!/bin/bash

# IELTS Appointment Monitor - Uninstall Script for Linux/macOS
# This script removes the IELTS Appointment Monitor from your system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="ielts-appointment-monitor"
INSTALL_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.ielts-monitor"
APP_DIR="$HOME/.local/share/$APP_NAME"

# Functions
print_header() {
    echo -e "${RED}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║            IELTS Appointment Monitor Uninstaller            ║"
    echo "║                                                              ║"
    echo "║  This script will remove the IELTS Appointment Monitor      ║"
    echo "║  from your system and optionally clean up data files.       ║"
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

stop_monitor() {
    print_step "Stopping any running monitor processes..."
    
    if check_command ielts-monitor; then
        ielts-monitor stop 2>/dev/null || true
        print_success "Monitor stopped"
    fi
    
    # Kill any remaining processes
    pkill -f "ielts-monitor" 2>/dev/null || true
    pkill -f "ielts-appointment-monitor" 2>/dev/null || true
}

remove_global_installation() {
    print_step "Removing global installation..."
    
    local removed=false
    
    # Try npm unlink first
    if npm unlink "$APP_NAME" 2>/dev/null; then
        print_success "Removed npm global link"
        removed=true
    fi
    
    # Remove manual installation
    if [[ -f "$INSTALL_DIR/ielts-monitor" ]]; then
        rm -f "$INSTALL_DIR/ielts-monitor"
        print_success "Removed executable from $INSTALL_DIR"
        removed=true
    fi
    
    # Remove application directory
    if [[ -d "$APP_DIR" ]]; then
        rm -rf "$APP_DIR"
        print_success "Removed application files from $APP_DIR"
        removed=true
    fi
    
    if [[ "$removed" == "false" ]]; then
        print_warning "No global installation found"
    fi
}

remove_config_and_data() {
    if [[ ! -d "$CONFIG_DIR" ]]; then
        print_warning "No configuration directory found at $CONFIG_DIR"
        return
    fi
    
    echo
    echo -e "${YELLOW}Configuration and data removal:${NC}"
    echo "The following directory contains your configuration and data:"
    echo "  $CONFIG_DIR"
    echo
    echo "Contents:"
    if [[ -d "$CONFIG_DIR" ]]; then
        ls -la "$CONFIG_DIR" 2>/dev/null || echo "  (empty or inaccessible)"
    fi
    echo
    
    read -p "Do you want to remove configuration and data files? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Removing configuration and data files..."
        rm -rf "$CONFIG_DIR"
        print_success "Configuration and data files removed"
    else
        print_warning "Configuration and data files preserved at $CONFIG_DIR"
        echo "You can manually remove them later if needed"
    fi
}

verify_removal() {
    print_step "Verifying removal..."
    
    local issues=false
    
    # Check if command still exists
    if check_command ielts-monitor; then
        print_warning "ielts-monitor command still available (may be in different location)"
        issues=true
    fi
    
    # Check for remaining files
    if [[ -f "$INSTALL_DIR/ielts-monitor" ]]; then
        print_warning "Executable still exists at $INSTALL_DIR/ielts-monitor"
        issues=true
    fi
    
    if [[ -d "$APP_DIR" ]]; then
        print_warning "Application directory still exists at $APP_DIR"
        issues=true
    fi
    
    if [[ "$issues" == "false" ]]; then
        print_success "Uninstallation verification passed"
    else
        print_warning "Some files may still exist - manual cleanup may be required"
    fi
}

print_completion_message() {
    echo
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                   Uninstallation Complete!                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo
    echo "🗑️  IELTS Appointment Monitor has been removed from your system."
    echo
    
    if [[ -d "$CONFIG_DIR" ]]; then
        echo "📁 Configuration files preserved at:"
        echo "   $CONFIG_DIR"
        echo
        echo "   To completely remove all traces, run:"
        echo "   ${RED}rm -rf $CONFIG_DIR${NC}"
        echo
    fi
    
    echo "Thank you for using IELTS Appointment Monitor!"
}

# Main uninstallation process
main() {
    print_header
    
    # Confirmation
    echo "This will remove the IELTS Appointment Monitor from your system."
    echo
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Uninstallation cancelled"
        exit 0
    fi
    
    echo
    
    # Uninstallation steps
    stop_monitor
    remove_global_installation
    remove_config_and_data
    verify_removal
    
    print_completion_message
}

# Check if running as root (not recommended)
if [[ $EUID -eq 0 ]]; then
    print_warning "Running as root is not recommended"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Uninstallation cancelled"
        exit 1
    fi
fi

# Run main uninstallation
main "$@"