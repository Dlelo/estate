#!/usr/bin/env bash
# Run ONCE on the droplet to get the first SSL certificate.
# DNS must already be pointing to this server.
#
# Usage: bash scripts/init-ssl.sh your@email.com

set -e

EMAIL="${1:?Usage: $0 deroestate@gmail.com}"
DOMAIN="deroestate.com"

# Install certbot
apt-get update && apt-get install -y certbot

# Stop the frontend to free port 80 for standalone verification
cd ~/estate-manager
docker compose stop frontend

# Get the certificate
certbot certonly --standalone \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email

# Rebuild frontend with the HTTPS nginx.conf and restart everything
docker compose up --build -d

# Set up automatic renewal every day at 3am + reload nginx after renewal
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker compose -f /root/estate-manager/docker-compose.yml exec -T frontend nginx -s reload") | crontab -

echo ""
echo "=== SSL configured! ==="
echo "Visit https://$DOMAIN"
