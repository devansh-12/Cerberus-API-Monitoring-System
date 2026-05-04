variable "kube_config" {
  description = "Path to the kube config file"
  type        = string
  default     = "~/.kube/config"
}

variable "image_name" {
  description = "Docker image to deploy"
  type        = string
  default     = "registry.gitlab.com/my-org/cerberus-api:latest"
}
