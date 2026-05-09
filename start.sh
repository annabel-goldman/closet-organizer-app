#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/back-end"
FRONTEND_DIR="$ROOT_DIR/front-end"

print_usage() {
  cat <<'EOF'
Usage:
  ./start.sh
  ./start.sh port=4100
  ./start.sh backend-port=3100 frontend-port=5174

Options:
  port=NNNN           Set the backend to NNNN and the frontend to NNNN+1.
  backend-port=NNNN   Set the Rails backend port explicitly.
  frontend-port=NNNN  Set the Vite frontend port explicitly.
  help, --help, -h    Show this help text.

Environment variables still work:
  BACKEND_HOST, BACKEND_PORT, FRONTEND_HOST, FRONTEND_PORT
EOF
}

is_valid_port() {
  local port="$1"
  [[ "$port" =~ ^[0-9]+$ ]] && ((port >= 1 && port <= 65535))
}

load_env_file() {
  local env_file="$1"
  local line
  local key
  local value

  if [[ ! -f "$env_file" ]]; then
    return
  fi

  echo "Loading environment from ${env_file#$ROOT_DIR/}"

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"

    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[2]}"
      value="${BASH_REMATCH[3]}"

      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"

      if [[ "$value" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi

      export "$key=$value"
      continue
    fi

    echo "Warning: skipping invalid env line in ${env_file#$ROOT_DIR/}: $line" >&2
  done < "$env_file"
}

CLI_BASE_PORT=""
CLI_BACKEND_PORT=""
CLI_FRONTEND_PORT=""

for arg in "$@"; do
  case "$arg" in
    help|--help|-h)
      print_usage
      exit 0
      ;;
    port=*)
      CLI_BASE_PORT="${arg#port=}"
      ;;
    backend-port=*)
      CLI_BACKEND_PORT="${arg#backend-port=}"
      ;;
    frontend-port=*)
      CLI_FRONTEND_PORT="${arg#frontend-port=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "$CLI_BASE_PORT" ]]; then
  if ! is_valid_port "$CLI_BASE_PORT"; then
    echo "Invalid port value for port=: $CLI_BASE_PORT" >&2
    exit 1
  fi

  if [[ -z "$CLI_BACKEND_PORT" ]]; then
    CLI_BACKEND_PORT="$CLI_BASE_PORT"
  fi

  if [[ -z "$CLI_FRONTEND_PORT" ]]; then
    if ((CLI_BASE_PORT == 65535)); then
      echo "port=65535 requires an explicit frontend-port because 65536 is not a valid port." >&2
      exit 1
    fi

    CLI_FRONTEND_PORT="$((CLI_BASE_PORT + 1))"
  fi
fi

if [[ -n "$CLI_BACKEND_PORT" ]] && ! is_valid_port "$CLI_BACKEND_PORT"; then
  echo "Invalid backend port: $CLI_BACKEND_PORT" >&2
  exit 1
fi

if [[ -n "$CLI_FRONTEND_PORT" ]] && ! is_valid_port "$CLI_FRONTEND_PORT"; then
  echo "Invalid frontend port: $CLI_FRONTEND_PORT" >&2
  exit 1
fi

INITIAL_BACKEND_HOST="${BACKEND_HOST:-}"
INITIAL_BACKEND_PORT="${BACKEND_PORT:-}"
INITIAL_FRONTEND_HOST="${FRONTEND_HOST:-}"
INITIAL_FRONTEND_PORT="${FRONTEND_PORT:-}"

BACKEND_PID=""
FRONTEND_PID=""

kill_matching_processes() {
  local pattern="$1"
  local service_name="$2"
  local pids

  pids="$(pgrep -f "$pattern" 2>/dev/null | sort -u || true)"
  if [[ -z "$pids" ]]; then
    return
  fi

  echo "Stopping existing ${service_name} process(es): ${pids}"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    kill "$pid" 2>/dev/null || true
  done <<< "$pids"
}

kill_processes_on_port() {
  local port="$1"
  local service_name="$2"
  local pids

  pids="$(lsof -ti "tcp:${port}" 2>/dev/null | sort -u || true)"
  if [[ -z "$pids" ]]; then
    return
  fi

  echo "Stopping existing ${service_name} process(es) on port ${port}: ${pids}"
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    kill "$pid" 2>/dev/null || true
  done <<< "$pids"

  for _ in {1..10}; do
    if ! lsof -ti "tcp:${port}" >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done

  pids="$(lsof -ti "tcp:${port}" 2>/dev/null | sort -u || true)"
  if [[ -n "$pids" ]]; then
    echo "Force stopping stubborn ${service_name} process(es) on port ${port}: ${pids}"
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      kill -9 "$pid" 2>/dev/null || true
    done <<< "$pids"
  fi
}

cleanup() {
  trap - EXIT INT TERM

  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi

  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi

  wait "${FRONTEND_PID}" 2>/dev/null || true
  wait "${BACKEND_PID}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

if [[ ! -d "$BACKEND_DIR" || ! -d "$FRONTEND_DIR" ]]; then
  echo "Expected back-end/ and front-end/ directories under $ROOT_DIR" >&2
  exit 1
fi

if [[ ! -x "$BACKEND_DIR/bin/dev" ]]; then
  echo "Missing executable backend launcher at $BACKEND_DIR/bin/dev" >&2
  exit 1
fi

if [[ ! -x "$BACKEND_DIR/bin/rails" ]]; then
  echo "Missing executable Rails binary at $BACKEND_DIR/bin/rails" >&2
  exit 1
fi

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "Missing frontend package.json at $FRONTEND_DIR/package.json" >&2
  exit 1
fi

load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/.env.local"
load_env_file "$BACKEND_DIR/.env"
load_env_file "$BACKEND_DIR/.env.local"
load_env_file "$FRONTEND_DIR/.env"
load_env_file "$FRONTEND_DIR/.env.local"

BACKEND_HOST="${INITIAL_BACKEND_HOST:-${BACKEND_HOST:-127.0.0.1}}"
BACKEND_PORT="${INITIAL_BACKEND_PORT:-${BACKEND_PORT:-3000}}"
FRONTEND_HOST="${INITIAL_FRONTEND_HOST:-${FRONTEND_HOST:-127.0.0.1}}"
FRONTEND_PORT="${INITIAL_FRONTEND_PORT:-${FRONTEND_PORT:-5173}}"

if [[ -n "$CLI_BACKEND_PORT" ]]; then
  BACKEND_PORT="$CLI_BACKEND_PORT"
fi

if [[ -n "$CLI_FRONTEND_PORT" ]]; then
  FRONTEND_PORT="$CLI_FRONTEND_PORT"
fi

export BACKEND_HOST BACKEND_PORT FRONTEND_HOST FRONTEND_PORT

echo "Running backend migrations"
(
  cd "$BACKEND_DIR"
  ./bin/rails db:migrate
)

kill_matching_processes "$FRONTEND_DIR/node_modules/.bin/vite" "frontend dev server"
kill_processes_on_port "$BACKEND_PORT" "backend"
kill_processes_on_port "$FRONTEND_PORT" "frontend"

echo "Starting backend on http://${BACKEND_HOST}:${BACKEND_PORT}"
(
  cd "$BACKEND_DIR"
  echo "Preparing backend database"
  ./bin/rails db:prepare
  FRONTEND_HOST="$FRONTEND_HOST" FRONTEND_PORT="$FRONTEND_PORT" exec ./bin/dev -b "$BACKEND_HOST" -p "$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "Starting frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT}"
(
  cd "$FRONTEND_DIR"
  BACKEND_HOST="$BACKEND_HOST" \
  BACKEND_PORT="$BACKEND_PORT" \
  VITE_BACKEND_BASE_URL="http://${BACKEND_HOST}:${BACKEND_PORT}" \
  exec npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort
) &
FRONTEND_PID=$!

echo "Both services are starting."
echo "Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo "Backend:  http://${BACKEND_HOST}:${BACKEND_PORT}"
echo "Press Ctrl+C to stop both."

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    wait "$BACKEND_PID"
    exit $?
  fi

  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    wait "$FRONTEND_PID"
    exit $?
  fi

  sleep 1
done
