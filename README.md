[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/murnix-kube)](https://artifacthub.io/packages/search?repo=murnix-kube)

# Kubernetes Monitoring

## Introduction

Murnitur offers comprehensive kubernetes monitoring capabilities, allowing users to effortlessly monitor and manage their Kubernetes clusters. This documentation provides detailed instructions on connecting your Kubernetes server to Murnitur for real-time insights into your pods, nodes, and other crucial metrics.

## Using Helm

We suggest utilizing Helm for installing `murnix-kube`, as it simplifies the process by handling multiple configuration setups effortlessly.

Add the `murnix-kube` repo:

```bash
helm repo add murnix-kube https://murnitur.github.io/murnix-kube/
```

To verify that the repository has been added successfully, you can run the following command:

```bash
helm repo list
```

This command will display a list of all the Helm repositories that have been added to your local environment. If `murnix-kube` appears in the list, then the repository has been added successfully.

### Install using flags

You can install `murnix-kube` by running the following command:

```bash
helm upgrade --install murnix-kube murnix-kube/murnix-kube \
--set env.MURNITUR_PROJECT_ID=<INSERT_YOUR_PROJECT_ID> \
--set env.CLUSTER_NAME=<TYPE_IN_THE_NAME_OF_CLUSTER> \
--create-namespace --namespace murnitur
```

Additional flags you could set are:

| Option                 | Description                                                                                           | Default Value | Data Type   |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------- | ----------- |
| `env.NAMESPACES`       | Defines the namespaces to observe. Value could be `murnitur,default,kube-system`                      | `*`           | string      |
| `env.PORT`             | Specifies the port you want `murnix-kube` to run on.                                                  | `2024`        | string      |
| `env.KUBE_CONFIG_PATH` | We use the default kube-config to establish connection to your cluster. Setting this, overrides that. | `""`          | file \| url |

### Install using values.yaml

You can also opt for installation using the `values.yaml` file to streamline the process. This way, you won't have to manually input all those commands in the terminal.

Simply edit the `values.yaml` sample from [GitHub](https://murnitur.github.io/murnix-kube/values.yaml), or copy the contents below into a `values.yaml` file. Then, run the install command, passing the YAML file as an argument.

```bash
helm upgrade --install murnix-kube murnix-kube/murnix-kube \
--create-namespace --namespace murnitur \
-f values.yaml
```

Contents from values.yaml file:

```yaml
metrics-server:
  args:
    - --kubelet-insecure-tls # Remove this line if you want to enable TLS certificate validation

# Environment variables
env:
  # The URL of the Murnitur API for accessing infrastructures
  API_URL: https://api.murnitur.com/api/infrastructures

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

### Change configurations

Let's attempt to modify the port number on which our installed chart operates from 2024 to 8080.

```bash
helm upgrade murnix-kube murnix-kube/murnix-kube \
--namespace murnitur \
--set env.PORT=\"8080\"
```

Ugrade to a newer version:

```bash
helm upgrade --install murnix-kube murnix-kube/murnix-kube \
--namespace murnitur \
--version=<NEW_VERSION_NUMBER>
```

### Removing murnix-kube

Run the following command to uninstall `murnix-kube`:

```bash
helm uninstall murnix-kube -n murnitur
```

## Verify installation

You can check if the installation was successfully installed by running the following commands:

```bash
kubectl get ns murnitur
```

It should return an output that looks like this:

```bash
NAME       STATUS   AGE
murnitur   Active   4m23s
```

Get the running pods:

```bash
kubectl get pods -n murnitur
```

You should get this as an output:

```bash
NAME                                          READY   STATUS    RESTARTS   AGE
murnix-kube-c75bc4949-7n6cb                   1/1     Running   0          6m1s
murnix-kube-metrics-server-795bbbcddf-dnzkq   1/1     Running   0          6m1s
```

## Support

For any assistance or support needs, please contact [support@murnitur.com](mailto:support@murnitur.com).
