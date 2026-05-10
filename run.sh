#!/usr/bin/env bash
# =============================================================================
#  Cerberus API Monitoring System — Master Run Script
#  Usage:
#    ./run.sh [command] [options]
#
#  Commands:
#    docker          Build & run entire stack via Docker Compose
#    k8s             Build images & deploy to Kubernetes (minikube by default)
#    k8s:apply       Apply K8s manifests only (skips image builds)
#    k8s:delete      Tear down the full Kubernetes deployment
#    docker:down     Stop and remove Docker Compose stack
#    status          Show status of all running services
#    logs [service]  Tail logs (docker or kubectl)
#    help            Show this message
#
#  Environment Variables:
#    REGISTRY        Docker registry prefix  (default: "" → local images)
#    IMAGE_TAG       Docker image tag        (default: "1.0.0")
#    K8S_CONTEXT     kubectl context to use  (default: current context)
#    USE_MINIKUBE    Set to "true" to load images via minikube (default: true)
# =============================================================================

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}"; \
             echo -e "${BOLD}${CYAN}  $*${RESET}"; \
             echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}\n"; }

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${SCRIPT_DIR}/server"
CLIENT_DIR="${SCRIPT_DIR}/client"
K8S_DIR="${SCRIPT_DIR}/k8s"
COMPOSE_FILE="${SERVER_DIR}/docker-compose.yml"

REGISTRY="${REGISTRY:-}"
IMAGE_TAG="${IMAGE_TAG:-1.0.0}"
USE_MINIKUBE="${USE_MINIKUBE:-true}"
NAMESPACE="cerberus"

API_IMAGE="${REGISTRY:+${REGISTRY}/}cerberus-api:${IMAGE_TAG}"
CONSUMER_IMAGE="${REGISTRY:+${REGISTRY}/}cerberus-consumer:${IMAGE_TAG}"
FRONTEND_IMAGE="${REGISTRY:+${REGISTRY}/}cerberus-frontend:${IMAGE_TAG}"

# ── Preflight Checks ──────────────────────────────────────────────────────────
check_docker() {
  command -v docker &>/dev/null || error "Docker is not installed. Install from https://docs.docker.com/get-docker/"
  docker info &>/dev/null      || error "Docker daemon is not running. Start Docker Desktop or the Docker service."
}

check_kubectl() {
  command -v kubectl &>/dev/null || error "kubectl is not installed. Install from https://kubernetes.io/docs/tasks/tools/"
}

check_minikube() {
  command -v minikube &>/dev/null || error "minikube is not installed. Install from https://minikube.sigs.k8s.io/docs/start/"
  minikube status &>/dev/null    || { warn "minikube is not running. Starting..."; minikube start --driver=docker --memory=4096 --cpus=3; }
}

check_compose_env() {
  if [[ ! -f "${SERVER_DIR}/.env" ]]; then
    warn ".env not found in server/ — copying from .env.example"
    cp "${SERVER_DIR}/.env.example" "${SERVER_DIR}/.env"
    warn "Edit ${SERVER_DIR}/.env with real secrets before proceeding!"
    read -rp "Press ENTER to continue with example values, or Ctrl+C to abort: "
  fi
}

check_k8s_secret() {
  # Check if the secret has placeholder values
  if kubectl get secret cerberus-api-secret -n "${NAMESPACE}" &>/dev/null; then
    local pg_pass
    pg_pass=$(kubectl get secret cerberus-api-secret -n "${NAMESPACE}" \
      -o jsonpath='{.data.PG_PASSWORD}' | base64 -d 2>/dev/null || true)
    if [[ "${pg_pass}" == *"REPLACE_ME"* ]]; then
      error "cerberus-api-secret still contains REPLACE_ME placeholders.\nEdit k8s/secret.yaml with real values then re-apply."
    fi
  fi
}

# ── Image Build ───────────────────────────────────────────────────────────────
build_images() {
  header "Building Docker Images"

  info "Building API server image → ${API_IMAGE}"
  docker build \
    --file "${SERVER_DIR}/Dockerfile" \
    --tag  "${API_IMAGE}" \
    "${SERVER_DIR}"
  success "API image built"

  info "Building Consumer image → ${CONSUMER_IMAGE}"
  docker build \
    --file "${SERVER_DIR}/Dockerfile.consumer" \
    --tag  "${CONSUMER_IMAGE}" \
    "${SERVER_DIR}"
  success "Consumer image built"

  info "Building Frontend image → ${FRONTEND_IMAGE}"
  docker build \
    --file "${CLIENT_DIR}/Dockerfile" \
    --tag  "${FRONTEND_IMAGE}" \
    "${CLIENT_DIR}"
  success "Frontend image built"
}

load_images_minikube() {
  header "Loading Images into Minikube"
  info "Loading ${API_IMAGE}..."
  minikube image load "${API_IMAGE}"
  info "Loading ${CONSUMER_IMAGE}..."
  minikube image load "${CONSUMER_IMAGE}"
  info "Loading ${FRONTEND_IMAGE}..."
  minikube image load "${FRONTEND_IMAGE}"
  success "All images loaded into minikube"
}

push_images_registry() {
  if [[ -z "${REGISTRY}" ]]; then
    warn "REGISTRY is not set — skipping push (using local images)"
    return
  fi
  header "Pushing Images to Registry: ${REGISTRY}"
  docker push "${API_IMAGE}"
  docker push "${CONSUMER_IMAGE}"
  docker push "${FRONTEND_IMAGE}"
  success "Images pushed"
}

# ── Kubernetes Apply ──────────────────────────────────────────────────────────
k8s_apply_manifests() {
  header "Applying Kubernetes Manifests"

  # Apply in dependency order
  info "Creating namespace..."
  kubectl apply -f "${K8S_DIR}/namespace.yaml"

  info "Applying ConfigMap & Secrets..."
  kubectl apply -f "${K8S_DIR}/configmap.yaml"

  # Apply secret.yaml if it exists and doesn't have REPLACE_ME
  if [[ -f "${K8S_DIR}/secret.yaml" ]]; then
    if grep -q "REPLACE_ME" "${K8S_DIR}/secret.yaml"; then
      error "k8s/secret.yaml still has REPLACE_ME placeholders.\nCopy k8s/secret.example.yaml → k8s/secret.yaml, fill in real values, then re-run."
    fi
    kubectl apply -f "${K8S_DIR}/secret.yaml"
    success "Secret applied"
  else
    warn "k8s/secret.yaml not found."
    warn "Copy k8s/secret.example.yaml → k8s/secret.yaml, fill in real values, then re-run."
    error "Aborting — secret.yaml is required."
  fi

  info "Deploying infrastructure (Redis)..."
  kubectl apply -f "${K8S_DIR}/redis.yaml"

  info "Deploying databases (PostgreSQL, MongoDB)..."
  kubectl apply -f "${K8S_DIR}/postgres.yaml"
  kubectl apply -f "${K8S_DIR}/mongodb.yaml"

  info "Deploying message broker (RabbitMQ)..."
  kubectl apply -f "${K8S_DIR}/rabbitmq.yaml"

  info "Waiting for databases to become ready..."
  kubectl rollout status statefulset/cerberus-postgres -n "${NAMESPACE}" --timeout=120s
  kubectl rollout status statefulset/cerberus-mongo    -n "${NAMESPACE}" --timeout=120s
  kubectl rollout status statefulset/cerberus-rabbitmq -n "${NAMESPACE}" --timeout=120s
  kubectl rollout status deployment/cerberus-redis     -n "${NAMESPACE}" --timeout=60s

  info "Deploying application services..."
  kubectl apply -f "${K8S_DIR}/deployment.yaml"
  kubectl apply -f "${K8S_DIR}/consumer.yaml"
  kubectl apply -f "${K8S_DIR}/frontend.yaml"

  info "Applying Ingress..."
  kubectl apply -f "${K8S_DIR}/ingress.yaml"

  info "Waiting for application pods to be ready..."
  kubectl rollout status deployment/cerberus-api      -n "${NAMESPACE}" --timeout=120s
  kubectl rollout status deployment/cerberus-consumer -n "${NAMESPACE}" --timeout=120s
  kubectl rollout status deployment/cerberus-frontend -n "${NAMESPACE}" --timeout=60s

  success "All manifests applied and workloads are ready!"
}

# ── Access Info ───────────────────────────────────────────────────────────────
print_access_info() {
  header "Access Information"

  if [[ "${USE_MINIKUBE}" == "true" ]]; then
    local minikube_ip
    minikube_ip=$(minikube ip 2>/dev/null || echo "N/A")
    echo -e "${BOLD}Minikube IP:${RESET} ${minikube_ip}"
    echo ""
    echo -e "${BOLD}Direct NodePort Access:${RESET}"
    echo -e "  Frontend   → http://${minikube_ip}:30080"
    echo -e "  RabbitMQ   → http://${minikube_ip}:31672  (management UI)"
    echo ""
    echo -e "${BOLD}Via Ingress (add to /etc/hosts):${RESET}"
    echo -e "  ${minikube_ip}  cerberus.local"
    echo -e "  Then open:  http://cerberus.local"
    echo -e "  API:        http://cerberus.local/api"
    echo ""
    echo -e "${BOLD}Enable Ingress (if not already):${RESET}"
    echo -e "  minikube addons enable ingress"
    echo ""
    echo -e "${BOLD}Port-forward shortcuts:${RESET}"
    echo -e "  kubectl port-forward svc/cerberus-frontend-service 3000:80 -n ${NAMESPACE}"
    echo -e "  kubectl port-forward svc/cerberus-api-service      5000:5000 -n ${NAMESPACE}"
    echo -e "  kubectl port-forward svc/cerberus-rabbitmq-mgmt   15672:15672 -n ${NAMESPACE}"
  else
    echo -e "  Frontend → http://cerberus.local  (via Ingress)"
    echo -e "  API      → http://cerberus.local/api"
  fi
}

# ── Status ────────────────────────────────────────────────────────────────────
cmd_status() {
  check_kubectl
  header "Cerberus Cluster Status — namespace: ${NAMESPACE}"
  echo -e "${BOLD}Pods:${RESET}"
  kubectl get pods -n "${NAMESPACE}" -o wide 2>/dev/null || warn "No pods found (namespace may not exist yet)"
  echo ""
  echo -e "${BOLD}Services:${RESET}"
  kubectl get svc -n "${NAMESPACE}" 2>/dev/null || true
  echo ""
  echo -e "${BOLD}Deployments:${RESET}"
  kubectl get deployments -n "${NAMESPACE}" 2>/dev/null || true
  echo ""
  echo -e "${BOLD}StatefulSets:${RESET}"
  kubectl get statefulsets -n "${NAMESPACE}" 2>/dev/null || true
  echo ""
  echo -e "${BOLD}Ingress:${RESET}"
  kubectl get ingress -n "${NAMESPACE}" 2>/dev/null || true
}

# ── Logs ──────────────────────────────────────────────────────────────────────
cmd_logs() {
  local service="${1:-}"
  if [[ -z "${service}" ]]; then
    echo "Available services: api, consumer, frontend, postgres, mongo, rabbitmq, redis"
    read -rp "Which service? " service
  fi

  local label
  case "${service}" in
    api)       label="cerberus-api" ;;
    consumer)  label="cerberus-consumer" ;;
    frontend)  label="cerberus-frontend" ;;
    postgres)  label="cerberus-postgres" ;;
    mongo)     label="cerberus-mongo" ;;
    rabbitmq)  label="cerberus-rabbitmq" ;;
    redis)     label="cerberus-redis" ;;
    *)         error "Unknown service: ${service}" ;;
  esac

  info "Streaming logs for ${service} (app=${label})..."
  kubectl logs -f -l "app=${label}" -n "${NAMESPACE}" --all-containers --max-log-requests=10
}

# ── Teardown ──────────────────────────────────────────────────────────────────
cmd_k8s_delete() {
  header "Tearing Down Kubernetes Deployment"
  check_kubectl
  warn "This will delete ALL Cerberus resources in namespace '${NAMESPACE}'."
  read -rp "Are you sure? (yes/no): " confirm
  if [[ "${confirm}" != "yes" ]]; then
    info "Aborted."
    exit 0
  fi
  kubectl delete namespace "${NAMESPACE}" --ignore-not-found=true
  success "Namespace '${NAMESPACE}' deleted. All Cerberus resources removed."
}

cmd_docker_down() {
  header "Stopping Docker Compose Stack"
  check_docker
  docker compose -f "${COMPOSE_FILE}" --env-file "${SERVER_DIR}/.env" down --volumes --remove-orphans
  success "Docker Compose stack stopped and volumes removed."
}

# ── Main Commands ─────────────────────────────────────────────────────────────
cmd_docker() {
  header "Cerberus — Docker Compose Mode"
  check_docker
  check_compose_env

  info "Pulling base images..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${SERVER_DIR}/.env" pull --ignore-pull-failures 2>/dev/null || true

  info "Building application images..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${SERVER_DIR}/.env" build --parallel

  info "Starting full stack..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${SERVER_DIR}/.env" up -d

  echo ""
  success "Stack is up! Services:"
  echo -e "  API Server   → http://localhost:5000"
  echo -e "  Health Check → http://localhost:5000/health"
  echo -e "  pgAdmin      → http://localhost:8080"
  echo -e "  RabbitMQ UI  → http://localhost:15672"
  echo ""
  info "Tail logs with:  $0 logs [service]"
  info "Stop with:       $0 docker:down"
}

cmd_k8s() {
  header "Cerberus — Kubernetes Mode"
  check_docker
  check_kubectl

  if [[ "${USE_MINIKUBE}" == "true" ]]; then
    check_minikube
    info "Using minikube Docker daemon for builds..."
    eval "$(minikube docker-env)"
  fi

  build_images

  if [[ "${USE_MINIKUBE}" == "true" ]]; then
    load_images_minikube
  else
    push_images_registry
  fi

  k8s_apply_manifests
  print_access_info
}

cmd_k8s_apply() {
  header "Cerberus — Apply K8s Manifests (skip build)"
  check_kubectl
  k8s_apply_manifests
  print_access_info
}

# ── Help ──────────────────────────────────────────────────────────────────────
cmd_help() {
  cat <<EOF

${BOLD}Cerberus API Monitoring System — Run Script${RESET}

${BOLD}USAGE:${RESET}
  ./run.sh <command> [options]

${BOLD}COMMANDS:${RESET}
  ${CYAN}docker${RESET}           Build & start entire stack with Docker Compose
  ${CYAN}k8s${RESET}              Build images + deploy to Kubernetes (minikube by default)
  ${CYAN}k8s:apply${RESET}        Apply K8s manifests only (assumes images already built/pushed)
  ${CYAN}k8s:delete${RESET}       Delete all Cerberus K8s resources (namespace + all)
  ${CYAN}docker:down${RESET}      Stop & remove Docker Compose stack + volumes
  ${CYAN}status${RESET}           Show K8s pod / service / deployment status
  ${CYAN}logs [service]${RESET}   Tail logs for a named service
  ${CYAN}help${RESET}             Show this message

${BOLD}ENVIRONMENT VARIABLES:${RESET}
  REGISTRY        Docker registry prefix   (e.g. "ghcr.io/yourorg", default: local)
  IMAGE_TAG       Image version tag        (default: "1.0.0")
  USE_MINIKUBE    Use minikube image load  (default: "true")

${BOLD}QUICK START (Docker Compose):${RESET}
  cp .env.example .env && \$EDITOR .env
  ./run.sh docker

${BOLD}QUICK START (Kubernetes / minikube):${RESET}
  cp k8s/secret.example.yaml k8s/secret.yaml && \$EDITOR k8s/secret.yaml
  ./run.sh k8s

${BOLD}SERVICES:${RESET}
  ┌─────────────────┬──────────────────────────────────────────┐
  │ Service         │ Description                              │
  ├─────────────────┼──────────────────────────────────────────┤
  │ cerberus-api    │ Express API server (auth/client/ingest)  │
  │ cerberus-consumer│ RabbitMQ message processor              │
  │ cerberus-frontend│ React dashboard (Nginx)                 │
  │ cerberus-postgres│ TimescaleDB (metrics hypertable)        │
  │ cerberus-mongo  │ MongoDB (auth & client documents)        │
  │ cerberus-rabbitmq│ RabbitMQ message broker                 │
  │ cerberus-redis  │ Redis API key cache                      │
  └─────────────────┴──────────────────────────────────────────┘

EOF
}

# ── Entry Point ───────────────────────────────────────────────────────────────
main() {
  local cmd="${1:-help}"
  shift || true

  case "${cmd}" in
    docker)        cmd_docker ;;
    k8s)           cmd_k8s ;;
    k8s:apply)     cmd_k8s_apply ;;
    k8s:delete)    cmd_k8s_delete ;;
    docker:down)   cmd_docker_down ;;
    status)        cmd_status ;;
    logs)          cmd_logs "$@" ;;
    help|--help|-h) cmd_help ;;
    *)             error "Unknown command: ${cmd}. Run './run.sh help'" ;;
  esac
}

main "$@"
