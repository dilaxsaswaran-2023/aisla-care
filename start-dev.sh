#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AISLA Care — Dev Launcher
#
# Usage:
#   ./start-dev.sh          # start frontend + backend-py
#   ./start-dev.sh --deps   # install all deps first, then start
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Colours
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend-py"

INSTALL_DEPS=false
for arg in "$@"; do
  case $arg in
    --deps|-d) INSTALL_DEPS=true ;;
  esac
done

# ── Detect OS / path style ────────────────────────────────────────────────────
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
  VENV_PYTHON="$BACKEND_DIR/venv/Scripts/python"
  VENV_PIP="$BACKEND_DIR/venv/Scripts/pip"
else
  VENV_PYTHON="$BACKEND_DIR/venv/bin/python"
  VENV_PIP="$BACKEND_DIR/venv/bin/pip"
fi

# ── Install dependencies ──────────────────────────────────────────────────────
if [ "$INSTALL_DEPS" = true ]; then
  echo -e "${YELLOW}[1/3] Installing frontend npm dependencies...${NC}"
  cd "$FRONTEND_DIR"
  npm install
  echo -e "${GREEN}      ✓ npm install complete${NC}"

  echo -e "${YELLOW}[2/3] Setting up Python virtual environment...${NC}"
  cd "$BACKEND_DIR"
  if [ ! -d "venv" ]; then
    python -m venv venv
    echo -e "${GREEN}      ✓ venv created${NC}"
  else
    echo -e "${GREEN}      ✓ venv already exists${NC}"
  fi

  echo -e "${YELLOW}[3/3] Installing Python dependencies from requirements.txt...${NC}"
  "$VENV_PIP" install -r "$BACKEND_DIR/requirements.txt"
  echo -e "${GREEN}      ✓ pip install complete${NC}"
  echo ""
fi

# Verify venv exists (safety check when --deps was not passed)
if [ ! -f "$VENV_PYTHON" ]; then
  echo -e "${RED}Python venv not found at $BACKEND_DIR/venv${NC}"
  echo -e "${YELLOW}Run with --deps flag first:  ./start-dev.sh --deps${NC}"
  exit 1
fi

# ── Launch services ───────────────────────────────────────────────────────────
echo -e "${BLUE}► Starting Python backend  (http://localhost:5030)...${NC}"
cd "$BACKEND_DIR"
"$VENV_PYTHON" run.py &
BACKEND_PID=$!

echo -e "${BLUE}► Starting React frontend   (http://localhost:8030)...${NC}"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}┌─────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│  Both services started                      │${NC}"
echo -e "${GREEN}│  Frontend  →  http://localhost:8030         │${NC}"
echo -e "${GREEN}│  Backend   →  http://localhost:5030         │${NC}"
echo -e "${GREEN}│  API docs  →  http://localhost:5030/docs    │${NC}"
echo -e "${GREEN}└─────────────────────────────────────────────┘${NC}"
echo ""
echo "Press Ctrl+C to stop both services."

# ── Graceful shutdown ─────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down services...${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo -e "${GREEN}Done.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

wait "$BACKEND_PID" "$FRONTEND_PID"
