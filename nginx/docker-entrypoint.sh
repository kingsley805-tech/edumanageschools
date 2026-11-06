#!/bin/sh
set -e

# Default to port 80 if PORT environment variable is not provided.
# On Render, the platform automatically provides $PORT (typically 10000).
PORT="${PORT:-80}"

echo "==> EduManage Web: Configuring Nginx to listen on port ${PORT}..."
sed -i "s/LISTEN_PORT/${PORT}/g" /etc/nginx/conf.d/default.conf

# Runtime injection for client-side environment variables in JS bundles
echo "==> EduManage Web: Injecting runtime environment variables..."
for js_file in /usr/share/nginx/html/assets/*.js; do
  [ -f "$js_file" ] || continue
  if [ -n "$VITE_SUPABASE_URL" ]; then
    sed -i "s|__VITE_SUPABASE_URL__|${VITE_SUPABASE_URL}|g" "$js_file"
  fi
  if [ -n "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
    sed -i "s|__VITE_SUPABASE_PUBLISHABLE_KEY__|${VITE_SUPABASE_PUBLISHABLE_KEY}|g" "$js_file"
  fi
  if [ -n "$VITE_SUPABASE_PROJECT_ID" ]; then
    sed -i "s|__VITE_SUPABASE_PROJECT_ID__|${VITE_SUPABASE_PROJECT_ID}|g" "$js_file"
  fi
  if [ -n "$VITE_PUBLIC_APP_URL" ]; then
    sed -i "s|__VITE_PUBLIC_APP_URL__|${VITE_PUBLIC_APP_URL}|g" "$js_file"
  fi
done

echo "==> EduManage Web: Starting Nginx..."
exec nginx -g "daemon off;"
