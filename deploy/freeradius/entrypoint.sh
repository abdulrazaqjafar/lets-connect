#!/bin/sh
set -e

export DB_HOST="${DB_HOST:-postgres}"
export DB_PORT="${DB_PORT:-5432}"
export DB_USER="${DB_USER:-postgres}"
export DB_PASSWORD="${DB_PASSWORD:-postgres}"
export DB_NAME="${DB_NAME:-lets_connect}"

envsubst '${DB_HOST} ${DB_PORT} ${DB_USER} ${DB_PASSWORD} ${DB_NAME}' \
  < /etc/freeradius/sql.template \
  > /etc/freeradius/mods-available/sql

exec freeradius -f "$@"
