# EduManage Docker & Render Deployment Guide

This guide covers how to containerize and deploy the **EduManage** application (Web Frontend and Voice Gateway server) using Docker and Docker Compose, with specialized instructions for the **Render** deployment platform.

---

## Architecture Overview

1. **`Dockerfile` (Root)**:
   - **Stage 1 (Builder)**: Uses `node:20-alpine` with `--ignore-scripts` to build production Vite assets into `/dist`, inlining any provided `VITE_*` environment variables.
   - **Stage 2 (Runner)**: Uses `nginx:1.27-alpine` to serve static assets with gzip compression, security headers, SPA client-side routing fallback (`try_files`), and a dynamic `$PORT` entrypoint script compatible with Render.
   - Includes `/healthz` endpoint for Render zero-downtime health checking.

2. **`server/voice-gateway/Dockerfile`**:
   - Multi-stage Node.js container compiling TypeScript and serving the Twilio & OpenAI Realtime AI Voice gateway.
   - Built-in `/health` endpoint for monitoring and Render health checking.

3. **Compose Files**:
   - `docker-compose.yml`: Standard local compose file running both services.
   - `docker-compose.prod.yml`: Production compose profile with resource limits, JSON logging rotation, and restart policies.
   - `docker-compose.dev.yml`: Development compose profile with live reload and host volume mounting.

4. **`render.yaml`**:
   - Infrastructure-as-Code Blueprint for 1-click provisioning of both web services on Render.

---

## 1. Quick Start with Docker Compose (Local)

### Prerequisites
Create a `.env` file in the project root with your Supabase credentials (copy from `.env.example`):
```bash
cp .env.example .env
```

### Build and Start Both Services
```bash
docker compose up --build
```

- **EduManage Web App**: [http://localhost:8080](http://localhost:8080)
- **Voice Gateway**: [http://localhost:8088](http://localhost:8088) (Health check: [http://localhost:8088/health](http://localhost:8088/health))

### Stop Containers
```bash
docker compose down
```

---

## 2. Running in Production Mode Locally

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

---

## 3. Running in Development Mode (Hot Reloading)

```bash
docker compose -f docker-compose.dev.yml up
```

---

## 4. Deploying to Render

You can deploy to Render in two ways:

### Option A: 1-Click Render Blueprint (Recommended)

1. Push your repository to **GitHub** or **GitLab**.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** and select **Blueprint**.
4. Select your repository. Render will automatically detect [`render.yaml`](./render.yaml).
5. Render will show the two services:
   - `edumanage-web` (Docker Web Service)
   - `edumanage-voice-gateway` (Docker Web Service)
6. Fill in the required environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   - `OPENAI_API_KEY` (if using Voice Gateway)
   - `SUPABASE_SERVICE_ROLE_KEY` (if using Voice Gateway)
7. Click **Apply**. Render will automatically build and deploy both services!

---

### Option B: Deploying EduManage Web Service Manually on Render

1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your Git repository.
3. Select **Docker** as the Runtime:
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `.`
4. In **Environment Variables**, add:
   - `PORT`: `10000` (Render's default)
5. In **Docker Build Arguments** (under Advanced):
   - `VITE_SUPABASE_URL`: `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: `<your-publishable-key>`
   - `VITE_SUPABASE_PROJECT_ID`: `<your-project-id>`
   *(Vite inlines these values during image compilation)*
6. In **Health Check Path**: `/healthz`
7. Click **Create Web Service**.

---

### Option C: Building for linux/amd64 and Pushing to Docker Hub / GHCR

If you are on an Apple Silicon Mac (M1/M2/M3/M4) or want to ensure 100% compatibility with Render's servers, explicitly build for `linux/amd64`:

#### Method 1: Using Docker Buildx (Recommended)
```bash
# 1. Build and push in a single step with buildx
docker buildx build --platform linux/amd64 \
  --build-arg VITE_SUPABASE_URL="https://your-project.supabase.co" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key" \
  --build-arg VITE_SUPABASE_PROJECT_ID="your-project-id" \
  -t <your-dockerhub-username>/edumanage-web:latest \
  --push .
```

#### Method 2: Standard Docker Build & Push
```bash
# 1. Build web image for linux/amd64
docker build --platform linux/amd64 \
  --build-arg VITE_SUPABASE_URL="https://your-project.supabase.co" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key" \
  --build-arg VITE_SUPABASE_PROJECT_ID="your-project-id" \
  -t <your-dockerhub-username>/edumanage-web:latest .

# 2. Push to Docker Hub
docker push <your-dockerhub-username>/edumanage-web:latest
```

*(Optional: Build and push the Voice Gateway backend)*:
```bash
docker buildx build --platform linux/amd64 \
  -t <your-dockerhub-username>/edumanage-voice-gateway:latest \
  --push ./server/voice-gateway
```

#### Deploy on Render:
1. In Render Dashboard, click **New +** &rarr; **Web Service** &rarr; **Deploy an existing image from a registry**.
2. Enter your image URL: `docker.io/<your-dockerhub-username>/edumanage-web:latest`.
3. Set **Health Check Path** to `/healthz`.
4. Click **Create Web Service**.
