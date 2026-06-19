import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  disconnectGoogle,
  fetchGoogleConnection,
  fetchGoogleOAuthConfig,
  getGoogleAuthUrl,
  GOOGLE_OAUTH_SETUP_HINT,
  LIVE_CLASSES_SETUP_SQL_URL,
  saveGoogleOAuthConfig,
} from "@/live-classes/lib/api";
import type { GoogleConnection } from "@/live-classes/lib/types";

type Props = {
  schoolId: string;
  disabled?: boolean;
  onConnectionChange?: (conn: GoogleConnection) => void;
};

const DEFAULT_REDIRECT =
  typeof window !== "undefined"
    ? `${window.location.origin}/admin/online-learning/oauth/callback`
    : "http://localhost:8080/admin/online-learning/oauth/callback";

export function GoogleConnectCard({ schoolId, disabled, onConnectionChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(DEFAULT_REDIRECT);

  const load = async () => {
    setLoading(true);
    try {
      const [conn, cfg] = await Promise.all([
        fetchGoogleConnection(schoolId),
        fetchGoogleOAuthConfig(schoolId),
      ]);
      setConnection(conn);
      onConnectionChange?.(conn);
      setOauthConfigured(cfg.configured);
      setSchemaReady(cfg.schemaReady);
      if (cfg.clientId) setClientId(cfg.clientId);
      if (cfg.redirectUri) setRedirectUri(cfg.redirectUri);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load Google connection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [schoolId]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await saveGoogleOAuthConfig(schoolId, clientId, clientSecret, redirectUri);
      setOauthConfigured(true);
      setClientSecret("");
      toast.success("Google OAuth settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const redirect = redirectUri || DEFAULT_REDIRECT;
      const url = await getGoogleAuthUrl(schoolId, redirect);
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Google sign-in");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGoogle(schoolId);
      toast.success("Google account disconnected");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disconnect failed");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Google Workspace
        </CardTitle>
        <CardDescription>
          Connect your school Google account to create Google Meet links. No Edge Function deploy
          required — credentials are stored per school in Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!schemaReady && (
          <Alert variant="destructive">
            <AlertTitle>One-time database setup</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{GOOGLE_OAUTH_SETUP_HINT}</p>
              <a
                href={LIVE_CLASSES_SETUP_SQL_URL}
                target="_blank"
                rel="noreferrer"
                className="underline font-medium text-sm"
              >
                Open Supabase SQL Editor
              </a>
            </AlertDescription>
          </Alert>
        )}

        {!oauthConfigured && !connection?.connected && schemaReady && (
          <Alert>
            <AlertTitle>Step 1 — Google Cloud credentials</AlertTitle>
            <AlertDescription className="space-y-3 pt-2">
              <p className="text-sm">
                Create an OAuth 2.0 Client in Google Cloud Console and paste the values below.
                Add the redirect URI to Google&apos;s authorized redirect URIs list.
              </p>
              <div className="space-y-2">
                <Label htmlFor="google-client-id">Client ID</Label>
                <Input
                  id="google-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxx.apps.googleusercontent.com"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="google-client-secret">Client Secret</Label>
                <Input
                  id="google-client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="GOCSPX-..."
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="google-redirect-uri">Redirect URI</Label>
                <Input
                  id="google-redirect-uri"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  disabled={disabled}
                />
              </div>
              <Button onClick={handleSaveConfig} disabled={savingConfig || disabled || !clientId || !clientSecret}>
                {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Google credentials
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {connection?.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-1">
                Connected
              </Badge>
              <p className="text-sm font-medium">{connection.email}</p>
              {connection.expiresAt && (
                <p className="text-xs text-muted-foreground">Token renews automatically</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting || disabled}>
                Reconnect
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                <Unlink className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={connecting || disabled || (!oauthConfigured && !clientId)}
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Connect Google Account
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
