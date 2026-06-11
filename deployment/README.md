# Eventguesser Kubernetes Deployment

Copy runtime data and panoramas to the MicroK8s node before applying the manifests:

```bash
ssh raspi@raspi "mkdir -p /home/raspi/development/eventguesser/data /home/raspi/development/eventguesser/panoramas"
rsync -av --progress public/data/ raspi@raspi:/home/raspi/development/eventguesser/data/
rsync -av --progress public/panoramas/ raspi@raspi:/home/raspi/development/eventguesser/panoramas/
```

Apply:

```bash
kubectl apply -f deployment/namespace.yaml
kubectl -n eventguesser create secret generic eventguesser-github --from-literal=token=YOUR_GITHUB_TOKEN
kubectl apply -f deployment/
```

Build and push the app image when it changes:

```bash
docker buildx build \
  --platform linux/arm64 \
  -t yingrjimsch/eventguesser:v0.0.1 \
  --push \
  .
```

The GitHub token only needs permission to create issues and comments in
`Yingrjimsch/eventguesser`.

Check:

```bash
kubectl -n eventguesser get pods
kubectl -n eventguesser get ingress
kubectl -n eventguesser logs deploy/eventguesser
```

The default host is `what-worldcup.yaaha.net`. Change it in `ingress.yaml` if needed.
