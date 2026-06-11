#!/bin/bash
set -e

BACKUP_DIR="$(dirname "$0")/../backups"

if [ -z "$1" ]; then
  echo "Uso: ./scripts/restore-db.sh <arquivo_backup.sql>"
  echo ""
  echo "Backups disponíveis:"
  ls -lh "$BACKUP_DIR"/*.sql 2>/dev/null | awk '{print "  " $NF, "(" $5 ")"}'  || echo "  Nenhum backup encontrado"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Arquivo não encontrado: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  ATENÇÃO: Isso irá restaurar o banco a partir de:"
echo "   $BACKUP_FILE"
echo ""
read -p "Tem certeza? Digite 'sim' para confirmar: " CONFIRM

if [ "$CONFIRM" != "sim" ]; then
  echo "Restauração cancelada."
  exit 0
fi

echo ""
echo "🔄 Restaurando banco de dados..."

# Aplica o backup SQL
psql "$DATABASE_URL" -f "$BACKUP_FILE"

echo ""
echo "✅ Banco restaurado com sucesso a partir de: $BACKUP_FILE"
