#!/bin/bash
# Деплой статики игры на прод-сервер.
# Использует SSH-ключ из .secrets/ (см. .secrets/server.md).
# Запуск: ./deploy.sh
set -euo pipefail

SERVER="claude@186.246.31.240"
SSH_KEY="$(dirname "$0")/.secrets/dino_server_ed25519"
REMOTE_DIR="/var/www/dino-math/"

if [[ ! -f "$SSH_KEY" ]]; then
    echo "❌ SSH-ключ не найден: $SSH_KEY" >&2
    echo "   Смотри .secrets/server.md или сгенерируй заново." >&2
    exit 1
fi

cd "$(dirname "$0")"

echo "→ rsync игры на $SERVER:$REMOTE_DIR"
# --chmod гарантирует читаемость для nginx (www-data) даже если локально
# директории идут с более жёсткими правами.
rsync -avz --delete \
    --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
    -e "ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
    --include='index.html' \
    --include='styles.css' \
    --include='game.js' \
    --include='assets/' \
    --include='assets/**' \
    --exclude='*' \
    ./ "$SERVER:$REMOTE_DIR"

echo "→ Готово.  Открывай:  http://186.246.31.240/"
