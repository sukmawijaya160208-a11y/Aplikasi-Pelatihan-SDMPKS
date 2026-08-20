#!/usr/bin/env bash
# ============================================================
# SDMPKS - Auto-deploy untuk Rumahweb Unlimited Hosting (Ultimate)
# ------------------------------------------------------------
# Dipanggil dari: GitHub Actions (SSH) ATAU cron cPanel.
# Fungsi:  git fetch -> deteksi commit baru -> pull -> lint PHP
#          -> health check -> rollback otomatis bila gagal.
#
# Asumsi:
#   - public_html sudah pernah di-`git clone` (remote origin main).
#   - SSH user = user cPanel, home = $HOME, app = $HOME/public_html.
#   - PHP CLI tersedia sebagai `php` (path /usr/local/bin/php).
#   - Domain aplikasi diisikan di DOMAIN di bawah.
#
# Set variabel lingkungan bila perlu (GitHub Actions):
#   DEPLOY_DOMAIN  - domain untuk health check (default: aplikasisdmpksa.online)
# ============================================================
set -euo pipefail

DOMAIN="${DEPLOY_DOMAIN:-aplikasisdmpksa.online}"
APP="$HOME/public_html"
BRANCH="main"
LOG="$HOME/deploy-rumahweb.log"
LOCK="$HOME/deploy-rumahweb.lock"

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

# --- Anti-bentrok: pastikan hanya satu proses deploy jalan ---
exec 9>"$LOCK"
if ! flock -n 9; then
  log "SKIP: deploy lain sedang berjalan."
  exit 0
fi

cd "$APP"

# --- Ambil commit terbaru dari remote ---
if ! git fetch origin "$BRANCH" >/dev/null 2>&1; then
  log "ERROR: git fetch gagal (remote?)"
  exit 1
fi

CURRENT_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse "origin/$BRANCH")

if [ "$CURRENT_HEAD" = "$REMOTE_HEAD" ]; then
  log "Tidak ada update. (HEAD=$CURRENT_HEAD)"
  exit 0
fi

log "Update terdeteksi: $CURRENT_HEAD -> $REMOTE_HEAD"

# --- Simpan HEAD lama untuk rollback ---
ROLLBACK_HEAD="$CURRENT_HEAD"

# --- Deploy (fast-forward / reset ke remote) ---
if ! git reset --hard "origin/$BRANCH" >/dev/null 2>&1; then
  log "ERROR: git reset gagal."
  exit 1
fi

# --- Lint PHP (semua file .php di api/) ---
if ! php -l api/config.php >/dev/null 2>&1; then
  log "ERROR: lint api/config.php gagal -> rollback."
  git reset --hard "$ROLLBACK_HEAD" >/dev/null 2>&1 || true
  exit 1
fi
LINT_FAIL=0
while IFS= read -r f; do
  if ! php -l "$f" >/dev/null 2>&1; then
    log "ERROR: lint $f gagal"
    LINT_FAIL=1
  fi
done < <(find api -name '*.php' -type f)
if [ "$LINT_FAIL" = "1" ]; then
  log "Lint gagal -> rollback ke $ROLLBACK_HEAD"
  git reset --hard "$ROLLBACK_HEAD" >/dev/null 2>&1 || true
  exit 1
fi

# --- Health check via HTTP ---
sleep 1
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$DOMAIN/" || echo 000)
if [ "$CODE" != "200" ]; then
  log "Health check gagal (HTTP $CODE) -> rollback ke $ROLLBACK_HEAD"
  git reset --hard "$ROLLBACK_HEAD" >/dev/null 2>&1 || true
  exit 1
fi

log "OK: deploy sukses, live di $REMOTE_HEAD (HTTP $CODE)."
exit 0