provider "kubernetes" {
  config_path = var.kube_config
}

resource "kubernetes_namespace" "cerberus" {
  metadata {
    name = "cerberus-namespace"
  }
}

resource "kubernetes_deployment" "cerberus_api" {
  metadata {
    name      = "cerberus-api"
    namespace = kubernetes_namespace.cerberus.metadata[0].name
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "cerberus-api"
      }
    }

    template {
      metadata {
        labels = {
          app = "cerberus-api"
        }
      }

      spec {
        container {
          image = var.image_name
          name  = "cerberus-api"

          port {
            container_port = 3000
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "cerberus_service" {
  metadata {
    name      = "cerberus-service"
    namespace = kubernetes_namespace.cerberus.metadata[0].name
  }
  spec {
    selector = {
      app = kubernetes_deployment.cerberus_api.spec[0].template[0].metadata[0].labels.app
    }
    port {
      port        = 80
      target_port = 3000
    }
    type = "LoadBalancer"
  }
}
