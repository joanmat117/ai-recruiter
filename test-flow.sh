#!/bin/bash
# Script de prueba end-to-end para AI Recruiter
# Uso: ./test-flow.sh [ruta-al-pdf]
# Requiere: jq instalado (brew install jq / apt-get install jq)

set -e

BASE_URL="http://localhost:3000"
PDF_PATH="${1:-./test-cv.pdf}"

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificar dependencias
if ! command -v jq &> /dev/null; then
    error "jq no está instalado. Instálalo: brew install jq / apt-get install jq"
    exit 1
fi

if [ ! -f "$PDF_PATH" ]; then
    error "Archivo PDF no encontrado: $PDF_PATH"
    echo "Uso: ./test-flow.sh [ruta-al-pdf]"
    exit 1
fi

log "=== Iniciando prueba E2E AI Recruiter ==="
log "PDF a usar: $PDF_PATH"

# 1. Obtener presigned POST
log "1. Obteniendo presigned POST..."
PRESIGNED=$(curl -s -X POST "$BASE_URL/recruiter/upload/presigned" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test-cv.pdf","contentType":"application/pdf"}')

if [ -z "$PRESIGNED" ] || [ "$PRESIGNED" = "null" ]; then
    error "No se pudo obtener presigned POST. ¿Está el servidor corriendo?"
    exit 1
fi

KEY=$(echo "$PRESIGNED" | jq -r '.key')
URL=$(echo "$PRESIGNED" | jq -r '.url')
POLICY=$(echo "$PRESIGNED" | jq -r '.fields.policy')
SIGNATURE=$(echo "$PRESIGNED" | jq -r '.fields."x-amz-signature"')
CREDENTIAL=$(echo "$PRESIGNED" | jq -r '.fields."x-amz-credential"')
ALGORITHM=$(echo "$PRESIGNED" | jq -r '.fields."x-amz-algorithm"')
DATE=$(echo "$PRESIGNED" | jq -r '.fields."x-amz-date"')

log "Key S3: $KEY"

# 2. Subir PDF a S3
log "2. Subiendo PDF a S3..."
UPLOAD_RESULT=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
  -F "key=$KEY" \
  -F "policy=$POLICY" \
  -F "x-amz-signature=$SIGNATURE" \
  -F "x-amz-credential=$CREDENTIAL" \
  -F "x-amz-algorithm=$ALGORITHM" \
  -F "x-amz-date=$DATE" \
  -F "file=@$PDF_PATH")

HTTP_CODE=$(echo "$UPLOAD_RESULT" | tail -n1)
if [ "$HTTP_CODE" != "204" ] && [ "$HTTP_CODE" != "200" ]; then
    error "Falló subida a S3 (HTTP $HTTP_CODE)"
    echo "$UPLOAD_RESULT" | head -n -1
    exit 1
fi
log "PDF subido correctamente (HTTP $HTTP_CODE)"

# 3. Encolar evaluación
log "3. Encolando evaluación..."
EVAL=$(curl -s -X POST "$BASE_URL/recruiter/evaluate" \
  -H "Content-Type: application/json" \
  -d "{
    \"s3Key\": \"$KEY\",
    \"jobDescription\": \"Buscamos Senior Fullstack Developer con 5+ años en React, Node.js, TypeScript, AWS, Docker. Valorable: Kubernetes, GraphQL.\",
    \"jobTitle\": \"Senior Fullstack Developer\"
  }")

JOB_ID=$(echo "$EVAL" | jq -r '.jobId')
STATUS=$(echo "$EVAL" | jq -r '.status')

if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
    error "Error encolando evaluación:"
    echo "$EVAL" | jq .
    exit 1
fi

log "Job ID: $JOB_ID"
log "Estado inicial: $STATUS"

# 4. Polling de estado
log "4. Esperando resultado (polling cada 3s, máx 30 intentos)..."
for i in {1..30}; do
    sleep 3
    STATUS_RESPONSE=$(curl -s "$BASE_URL/recruiter/status/$JOB_ID")
    STATE=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    
    echo -e "  ${YELLOW}Intento $i:${NC} $STATE"
    
    if [ "$STATE" = "completed" ]; then
        log "✅ ¡Evaluación completada!"
        echo ""
        echo "=== RECOMENDACIÓN ==="
        echo "$STATUS_RESPONSE" | jq '.result.recommendation'
        echo ""
        echo "=== SCORES ==="
        echo "$STATUS_RESPONSE" | jq '.result.scores'
        echo ""
        echo "=== PREGUNTAS DE ENTREVISTA ==="
        echo "$STATUS_RESPONSE" | jq '.result.output.interviewQuestions'
        echo ""
        echo "=== FEEDBACK ==="
        echo "$STATUS_RESPONSE" | jq '.result.output.feedbackForCandidate'
        exit 0
    elif [ "$STATE" = "failed" ]; then
        error "❌ La evaluación falló:"
        echo "$STATUS_RESPONSE" | jq .
        exit 1
    fi
done

error "⏰ Timeout: la evaluación no completó en 90 segundos"
echo "Último estado conocido:"
echo "$STATUS_RESPONSE" | jq .
exit 1