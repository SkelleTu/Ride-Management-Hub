#!/usr/bin/env bash
# Configura autenticação git com GITHUB_TOKEN automaticamente.
# Roda via 'prepare' do pnpm install — sem interação necessária.

if [ -z "$GITHUB_TOKEN" ]; then
  echo "[git-setup] GITHUB_TOKEN não encontrado — skipping git credential setup."
  exit 0
fi

git config credential.helper \
  '!f() { echo "username=x-access-token"; echo "password='"${GITHUB_TOKEN}"'"; }; f'

echo "[git-setup] Credenciais git configuradas com sucesso."
