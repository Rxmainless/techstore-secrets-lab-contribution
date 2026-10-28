#!/usr/bin/env bash
# Rotaciona a senha de um usuário do MySQL sem recriar o banco e sem perder dados.
#
# Uso:
#   bash scripts/rotate-db-password.sh app     usuário da aplicação (techstore_app)
#   bash scripts/rotate-db-password.sh root    usuário root
#
# Etapas: gera uma nova senha, aplica com ALTER USER autenticando como root pelo
# secret, confirma que a nova senha autentica e a antiga não, atualiza o arquivo
# de secret e recria o container da aplicação. Nenhuma senha é exibida.
set -euo pipefail

cd "$(dirname "$0")/.."

case "${1:-}" in
    app)
        target="db_password"
        login_user="techstore_app"
        accounts=("'techstore_app'@'%'")
        ;;
    root)
        target="db_root_password"
        login_user="root"
        accounts=("'root'@'%'" "'root'@'localhost'")
        ;;
    *)
        echo "uso: $0 {app|root}" >&2
        exit 1
        ;;
esac

target_file="secrets/$target"

if [ ! -s "$target_file" ]; then
    echo "erro: $target_file não encontrado" >&2
    exit 1
fi

if ! docker compose ps --status running --services | grep -qx database; then
    echo "erro: o serviço database precisa estar em execução" >&2
    exit 1
fi

# Executa SQL recebido pela entrada padrão, autenticando como root pelo secret.
mysql_as_root() {
    MSYS_NO_PATHCONV=1 docker compose exec -T database \
        sh -c 'MYSQL_PWD="$(cat /run/secrets/db_root_password)" exec mysql -uroot'
}

# Testa uma senha recebida pela entrada padrão.
can_login() {
    MSYS_NO_PATHCONV=1 docker compose exec -T database \
        sh -c "MYSQL_PWD=\"\$(cat)\" exec mysql -u$login_user -e 'SELECT 1' > /dev/null 2>&1"
}

old_password="$(cat "$target_file")"
new_password="$(openssl rand -base64 32 | tr -d '\r\n')"

pending_file="$(mktemp "secrets/.$target.pending.XXXXXX")"
chmod 600 "$pending_file"

# Se a nova senha ainda não foi aplicada no banco, o arquivo pendente é descartado
# em qualquer saída. Depois do ALTER USER, ele é preservado em caso de falha.
applied=0
trap '[ "$applied" = 1 ] || rm -f "$pending_file"' EXIT
printf '%s' "$new_password" > "$pending_file"

echo "aplicando a nova senha de $login_user no banco..."
for account in "${accounts[@]}"; do
    printf "ALTER USER %s IDENTIFIED BY '%s';\n" "$account" "$new_password"
done | mysql_as_root
applied=1

echo "verificando a nova senha..."
if ! printf '%s' "$new_password" | can_login; then
    echo "erro: a nova senha não autenticou; ela foi preservada em $pending_file" >&2
    exit 1
fi

if printf '%s' "$old_password" | can_login; then
    echo "erro: a senha antiga continua aceita; verifique o banco manualmente" >&2
    exit 1
fi

# Grava no mesmo arquivo (mesmo inode) para que os containers vejam o novo valor.
cat "$pending_file" > "$target_file"
rm -f "$pending_file"
unset old_password new_password

echo "recriando o container da aplicação..."
docker compose up -d --no-deps --force-recreate --wait app

echo "rotação concluída: $target"
