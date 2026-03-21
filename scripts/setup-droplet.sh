#!/usr/bin/env bash
# One-time setup script for the DigitalOcean droplet.
# Run this once on a fresh Ubuntu droplet BEFORE the first deployment.
#
# Usage:
#   ssh root@<droplet-ip>
#   curl -fsSL https://raw.githubusercontent.com/<your-user>/<your-repo>/main/scripts/setup-droplet.sh | bash
#
# Or copy and paste the contents manually.

set -e

echo "=== Estate Manager — Droplet Setup ==="

# ── 1. System update ──────────────────────────────────────────────────────────
apt-get update && apt-get upgrade -y

# ── 2. Install Docker ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "Docker installed: $(docker --version)"
else
  echo "Docker already installed: $(docker --version)"
fi

# ── 3. Clone the repository ───────────────────────────────────────────────────
REPO_URL="https://github.com/<your-username>/estate-manager.git"  # ← change this

if [ -d ~/estate-manager/.git ]; then
  echo "Repo already cloned."
else
  git clone "$REPO_URL" ~/estate-manager
  echo "Repo cloned."
fi

cd ~/estate-manager

# ── 4. Create .env file ───────────────────────────────────────────────────────
if [ -f .env ]; then
  echo ".env already exists — skipping. Delete it manually to recreate."
else
  echo ""
  echo "=== Configuring .env (press Enter to accept defaults) ==="

  read -rsp "DB_PASSWORD [estate]: " DB_PASSWORD
  DB_PASSWORD=${DB_PASSWORD:-estate}
  echo ""

  read -rsp "DB_ROOT_PASSWORD [rootpassword]: " DB_ROOT_PASSWORD
  DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD:-rootpassword}
  echo ""

  read -rsp "JWT_SECRET [leave blank for default]: " JWT_SECRET
  JWT_SECRET=${JWT_SECRET:-"EstateManager2026!SecretKey#XyZ\$PqR@LmN&WvT_AbCdEfGhIjKlMnOpQrStUvWxYz"}
  echo ""

  cat > .env << EOF
DB_PASSWORD=${DB_PASSWORD}
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
JWT_SECRET=${JWT_SECRET}
EOF

  chmod 600 .env
  echo ".env created."
fi

# ── 5. First deploy ───────────────────────────────────────────────────────────
echo ""
echo "=== Building and starting services (this takes a few minutes) ==="
docker compose up --build -d

echo ""
echo "=== Setup complete! ==="
echo "Your app is running at http://$(curl -s ifconfig.me)"
echo ""
echo "From now on, push to the main branch to auto-deploy via GitHub Actions."
