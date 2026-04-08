#!/usr/bin/env bash
set -e

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║       BigBlueBam Deployment Setup         ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Check we're in the right directory
if [ ! -f "docker-compose.yml" ] || [ ! -d "apps/api" ]; then
  echo "Error: Please run this script from the BigBlueBam repository root."
  exit 1
fi

# Check/install Node.js 22+
check_node() {
  if command -v node &>/dev/null; then
    local ver=$(node -v | cut -d. -f1 | tr -d v)
    if [ "$ver" -ge 22 ]; then
      return 0
    fi
  fi
  return 1
}

if ! check_node; then
  echo "Node.js 22+ is required but not found."
  echo ""
  if command -v brew &>/dev/null; then
    echo "Installing via Homebrew..."
    brew install node@22
  elif command -v apt-get &>/dev/null; then
    echo "Installing via apt..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v dnf &>/dev/null; then
    echo "Installing via dnf..."
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo dnf install -y nodejs
  elif command -v pacman &>/dev/null; then
    echo "Installing via pacman..."
    sudo pacman -S nodejs npm
  else
    echo "Automatic installation not available for your system."
    echo "Please install Node.js 22+ from: https://nodejs.org/"
    echo "Then re-run this script."
    exit 1
  fi

  if ! check_node; then
    echo "Node.js installation failed. Please install manually from https://nodejs.org/"
    exit 1
  fi
  echo "Node.js $(node -v) installed"
fi

# Check Docker
if ! command -v docker &>/dev/null; then
  echo ""
  echo "Docker is required but not installed."
  echo ""
  echo "Install Docker Desktop from:"
  echo "  macOS:  https://docs.docker.com/desktop/install/mac-install/"
  echo "  Linux:  https://docs.docker.com/engine/install/"
  echo ""
  echo "After installing, make sure Docker is running, then re-run this script."
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo ""
  echo "Docker is installed but not running."
  echo "Please start Docker Desktop and re-run this script."
  exit 1
fi

echo "Node.js $(node -v)"
echo "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
echo ""

# Hand off to Node.js orchestrator
exec node "$(dirname "$0")/deploy/main.mjs" "$@"
