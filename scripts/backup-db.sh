#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"

SQL_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"
JSON_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.json"

echo "🗄️  Iniciando backup do banco de dados..."
echo "   Timestamp: $TIMESTAMP"

# SQL dump completo (estrutura + dados)
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=plain \
  --file="$SQL_FILE"

echo "✅ SQL dump salvo: $SQL_FILE"

# JSON export portável (dados de todas as tabelas via psql)
TABLES=("users" "driver_profiles" "rides" "offers" "messages" "activity_log")

echo "{" > "$JSON_FILE"
echo "  \"exportedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> "$JSON_FILE"
echo "  \"tables\": {" >> "$JSON_FILE"

FIRST=1
for TABLE in "${TABLES[@]}"; do
  COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ${TABLE};" | tr -d ' ')
  JSON_DATA=$(psql "$DATABASE_URL" -t -c "SELECT json_agg(t) FROM (SELECT * FROM ${TABLE} ORDER BY id) t;")

  if [ "$JSON_DATA" = " " ] || [ -z "$(echo $JSON_DATA | tr -d ' ')" ]; then
    JSON_DATA="[]"
  fi

  if [ $FIRST -eq 0 ]; then
    echo "," >> "$JSON_FILE"
  fi
  FIRST=0

  printf "    \"%s\": %s" "$TABLE" "$JSON_DATA" >> "$JSON_FILE"
  echo "   $TABLE: $COUNT registros"
done

echo "" >> "$JSON_FILE"
echo "  }" >> "$JSON_FILE"
echo "}" >> "$JSON_FILE"

echo "✅ JSON export salvo: $JSON_FILE"

# Remove backups com mais de 30 dias
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +30 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "backup_*.json" -mtime +30 -delete 2>/dev/null || true

echo ""
echo "🎉 Backup concluído com sucesso!"
echo "   SQL: $SQL_FILE"
echo "   JSON: $JSON_FILE"
