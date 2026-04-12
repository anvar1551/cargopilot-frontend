# Lightsail Frontend Deployment

This frontend is intended to run on the same Lightsail server as the backend.

## Recommended runtime shape

- frontend container on `127.0.0.1:3000`
- backend API container on `127.0.0.1:4000`
- Nginx on ports `80` and later `443`

Public routing:

- `/` -> frontend
- `/api/` -> backend

Because of that, the frontend should use:

```env
NEXT_PUBLIC_API_URL=/api
```

Do not hardcode the Lightsail IP into the frontend build if frontend and backend
are served behind the same Nginx host.

## Server deploy steps

On the Lightsail server:

```bash
cd /opt/cargopilot
git clone https://github.com/anvar1551/cargopilot-frontend.git frontend
cd frontend
cp .env.docker.example .env.docker
nano .env.docker
```

Recommended `.env.docker`:

```env
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_PAYMENTS_ENABLED=false
NEXT_PUBLIC_SUPPORT_EMAIL=support@cargopilot.app
NEXT_PUBLIC_SUPPORT_PHONE=+49 40 0000 0000
```

Build and run:

```bash
docker compose --env-file .env.docker up -d --build
docker compose ps
docker compose logs -f frontend
```

## Nginx routing

Use Nginx to expose both frontend and backend on the same server:

```nginx
server {
    listen 80 default_server;
    server_name _;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## CI

The repo includes `.github/workflows/frontend-ci.yml`.

It validates every push and pull request by running:

- `npm ci`
- `npm run lint`
- `npm run build`
