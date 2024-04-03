[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/murnix-kube)](https://artifacthub.io/packages/search?repo=murnix-kube)

# Murnitur Kubernetes Monitoring Agent

## How to install

```bash
  helm repo add murnix-kube https://murnitur.github.io/murnix-kube/
```

```bash
  helm upgrade --install murnix-kube murnix-kube/murnix-kube --set env.MURNITUR_PROJECT_ID=<project-id> --set env.CLUSTER_NAME=<cluster-name>
```

You can also install using a `values.yaml` file:

```bash
  helm install murnix-kube murnix-kube/murnix-kube -f values.yaml
```

Contents of `values.yaml` are:

```yaml
  metrics-server:
  args:
    - --kubelet-insecure-tls # Remove this if you want to enable TLS certificate validation

  # Environment variables
env:

  # The unique identifier of the Murnitur project
  MURNITUR_PROJECT_ID: ""

  # The port number on which the application will run
  PORT: "2024"

  # The path to the Kubernetes configuration file (if needed)
  KUBE_CONFIG_PATH: ""

  # The name of the Kubernetes cluster
  CLUSTER_NAME: "murnix-kube"

  # Namespaces to observe. "*" means to observe all namespaces.
  # "default,murnitur" means to only observe the namespaces named default and murnitur.
  NAMESPACES: "*"



```
