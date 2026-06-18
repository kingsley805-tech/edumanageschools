import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  disconnectGoogle,
  fetchGoogleConnection,
  getGoogleAuthUrl,
} from "@/live-classes/lib/api";
import type { GoogleConnection } from "@/live-classes/lib/types";

type Props = {
  schoolId: string;
  onConnectionChange?: (conn: GoogleConnection) => void;
};

export function GoogleConnectCard({ schoolId, onConnectionChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connection, setConnection] = useState<GoogleConnection | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const conn = await fetchGoogleConnection(schoolId);
      setConnection(conn);
      onConnectionChange?.(conn);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load Google connection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [schoolId]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/admin/online-learning/oauth/callback`;
      const url = await getGoogleAuthUrl(schoolId, redirectUri);
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
          Connect your school Google account to automatically create Google Meet links for live classes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection?.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-1">Connected</Badge>
              <p className="text-sm font-medium">{connection.email}</p>
              {connection.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Token renews automatically
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting}>
                Reconnect
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                <Unlink className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Connect Google Account
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
