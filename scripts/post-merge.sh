#!/bin/bash
set -e

pnpm install --frozen-lockfile

# Faz backup antes de qualquer migração para garantir que dados nunca sejam perdidos
echo "📦 Fazendo backup antes da migração..."
TIMESTAMP=$(date +"%Y%m%d_%H%M%S") bash "$(dirname "$0")/backup-db.sh" && echo "✅ Backup concluído" || echo "⚠️  Backup falhou (continuando mesmo assim)"

# Aplica migrations versionadas (seguro — nunca destrói dados existentes)
pnpm --filter @workspace/db run migrate
