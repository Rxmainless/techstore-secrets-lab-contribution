#!/usr/bin/env bash
# Gera os arquivos de secrets usados pelo Docker Compose.
# Os valores nunca são versionados: o diretório secrets/ está no .gitignore.
#
# Uso:
#   bash scripts/generate-secrets.sh            gera apenas os secrets ausentes
#   FORCE=1 bash scripts/generate-secrets.sh    gera novos valores para todos (somente em ambiente novo)
#   Com o banco já inicializado, use scripts/rotate-db-password.sh para as senhas do banco.
#   Para rotacionar um único secret, apague o arquivo em secrets/ e rode este script.
set -euo pipefail

SECRETS_DIR="$(cd "$(dirname "$0")/.." && pwd)/secrets"

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

generate() {
    local name="$1"
    local file="$SECRETS_DIR/$name"

    if [ -s "$file" ] && [ "${FORCE:-0}" != "1" ]; then
        echo "mantido: $name (já existe; use FORCE=1 para gerar um novo valor)"
        return
    fi

    "${@:2}" | tr -d '\r\n' > "$file"
    chmod 644 "$file"
    echo "gerado:  $name"
}

generate db_root_password   openssl rand -base64 32
generate db_password        openssl rand -base64 24
generate internal_api_token openssl rand -hex 32
generate payment_api_key    sh -c 'printf "pk_test_%s" "$(openssl rand -hex 16)"'
