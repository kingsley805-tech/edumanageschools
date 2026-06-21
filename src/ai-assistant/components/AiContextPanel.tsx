import { Sparkles, User, Layers, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AiContext, AiUsageStats } from "../lib/types";
import { getContextActions } from "../lib/prompts";

type Props = {
  context: AiContext;
  usage?: AiUsageStats | null;
  onActionClick: (action: string) => void;
  className?: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  super_admin: "Super Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
  accountant: "Accountant",
  auditor: "Auditor",
};

export function AiContextPanel({ context, usage, onActionClick, className }: Props) {
  const actions = getContextActions(context);

  return (
    <aside className={className}>
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-indigo-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Layers className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Current module</p>
                  <p className="font-medium">{context.moduleLabel ?? "General"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Current user</p>
                  <p className="font-medium">
                    {ROLE_LABELS[context.userRole ?? ""] ?? context.userRole ?? "User"}
                  </p>
                </div>
              </div>
              {context.pagePath && (
                <p className="truncate text-[11px] text-muted-foreground">{context.pagePath}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4" />
                Available actions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button
                  key={a}
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal text-left text-xs"
                  onClick={() => onActionClick(`Help me: ${a}`)}
                >
                  {a}
                </Button>
              ))}
            </CardContent>
          </Card>

          {usage && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Usage this month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requests</span>
                  <span className="font-medium">
                    {usage.totalRequests} / {usage.monthlyLimit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens</span>
                  <span className="font-medium">{usage.totalTokens.toLocaleString()}</span>
                </div>
                <Badge variant={usage.remaining < 50 ? "destructive" : "secondary"}>
                  {usage.remaining} requests remaining
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
