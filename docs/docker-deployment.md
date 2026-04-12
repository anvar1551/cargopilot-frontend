# Docker Deployment

## Frontend image

The frontend is configured for a production Next.js standalone build.
Public browser variables are injected at build time, not at container runtime.

Build the image directly:

```bash
cd cargopilot-frontend

docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.your-domain.com \
  --build-arg NEXT_PUBLIC_PAYMENTS_ENABLED=false \
  --build-arg NEXT_PUBLIC_SUPPORT_EMAIL=support@your-domain.com \
  --build-arg NEXT_PUBLIC_SUPPORT_PHONE="+49 40 0000 0000" \
  -t your-dockerhub-user/cargopilot-frontend:latest .
```

Run it:

```bash
docker run -d \
  --name cargopilot-frontend \
  -p 3000:3000 \
  your-dockerhub-user/cargopilot-frontend:latest
```

Important:
- `NEXT_PUBLIC_API_URL` must point to the public backend URL the browser can reach.
- `NEXT_PUBLIC_*` values are baked into the frontend during `docker build`.
- If those values change, rebuild the image.

## Frontend with Docker Compose

Use the included `docker-compose.yml` and env template:

```bash
copy .env.docker.example .env.docker
```

Edit `.env.docker`, then run:

```bash
docker compose --env-file .env.docker up -d --build
```

Stop it:

```bash
docker compose --env-file .env.docker down
```

## Backend image

Build the backend image:

```bash
cd ../cargopilot-backend

docker build -t your-dockerhub-user/cargopilot-backend:latest .
```

Run backend stack locally with PostgreSQL and label worker:

```bash
docker compose up -d --build
```

The backend container entrypoint runs `prisma migrate deploy` automatically before startup.

## Push to registry

```bash
docker login

docker push your-dockerhub-user/cargopilot-frontend:latest
docker push your-dockerhub-user/cargopilot-backend:latest
```

## Deploy on server

Example flow on the server:

```bash
docker pull your-dockerhub-user/cargopilot-backend:latest
docker pull your-dockerhub-user/cargopilot-frontend:latest
```

Then either:
- run both with `docker run`
- or use the frontend `docker-compose.yml` from this repo plus a server-side backend compose file
- or place them behind Nginx / Traefik with separate domains:
  - `app.your-domain.com` -> frontend
  - `api.your-domain.com` -> backend

## Mobile app

The Expo driver app is not part of Docker deployment.
It should continue to be built and distributed separately.
