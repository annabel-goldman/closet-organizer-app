#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/back-end"
FRONTEND_DIR="$ROOT_DIR/front-end"

print_usage() {
  cat <<'EOF'
Usage:
  ./stop.sh
  ./stop.sh port=4100
  ./stop.sh backend-port=3100 frontend-port=5174

Options:
  port=NNNN           Stop backend on NNNN and frontend on NNNN+1.
  backend-port=NNNN   Stop the Rails backend port explicitly.
  frontend-port=NNNN  Stop the Vite frontend port explicitly.
  help, --help, -h    Show this help text.

Environment variables still work:
  BACKEND_PORT, FRONTEND_PORT
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
    echo "No ${service_name} process found on port ${port}."
    return
  fi

  echo "Stopping ${service_name} process(es) on port ${port}: ${pids}"
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

INITIAL_BACKEND_PORT="${BACKEND_PORT:-}"
INITIAL_FRONTEND_PORT="${FRONTEND_PORT:-}"

load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/.env.local"
load_env_file "$BACKEND_DIR/.env"
load_env_file "$BACKEND_DIR/.env.local"
load_env_file "$FRONTEND_DIR/.env"
load_env_file "$FRONTEND_DIR/.env.local"

BACKEND_PORT="${INITIAL_BACKEND_PORT:-${BACKEND_PORT:-3000}}"
FRONTEND_PORT="${INITIAL_FRONTEND_PORT:-${FRONTEND_PORT:-5173}}"

if [[ -n "$CLI_BACKEND_PORT" ]]; then
  BACKEND_PORT="$CLI_BACKEND_PORT"
fi

if [[ -n "$CLI_FRONTEND_PORT" ]]; then
  FRONTEND_PORT="$CLI_FRONTEND_PORT"
fi

kill_matching_processes "$FRONTEND_DIR/node_modules/.bin/vite" "frontend dev server"
kill_processes_on_port "$BACKEND_PORT" "backend"
kill_processes_on_port "$FRONTEND_PORT" "frontend"

echo "Local development processes stopped."
