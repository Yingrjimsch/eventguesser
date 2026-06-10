# Eventguesser Kubernetes Deployment

Copy runtime data and panoramas to the MicroK8s node before applying the manifests:

```bash
ssh pi@YOUR_PI "mkdir -p /srv/worldcup-guesser/data /srv/worldcup-guesser/panoramas"
rsync -av --progress public/data/ pi@YOUR_PI:/srv/worldcup-guesser/data/
rsync -av --progress public/panoramas/ pi@YOUR_PI:/srv/worldcup-guesser/panoramas/
```

Apply:

```bash
kubectl apply -f deployment/namespace.yaml
kubectl apply -f deployment/
```

Check:

```bash
kubectl -n eventguesser get pods
kubectl -n eventguesser get ingress
kubectl -n eventguesser logs deploy/eventguesser
```

The default host is `eventguesser.yaaha.net`. Change it in `ingress.yaml` if needed.
