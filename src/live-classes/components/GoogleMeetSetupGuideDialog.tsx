import { type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const LINKS = {
  cloudConsole: "https://console.cloud.google.com/",
  newProject: "https://console.cloud.google.com/projectcreate",
  calendarApi: "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
  oauthConsent: "https://console.cloud.google.com/apis/credentials/consent",
  credentials: "https://console.cloud.google.com/apis/credentials",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function CopyBlock({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-2 items-start">
        <code className="text-xs flex-1 break-all bg-muted px-2 py-1.5 rounded">{value}</code>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={copy}>
          Copy
        </Button>
      </div>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary underline underline-offset-2 font-medium"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function GoogleMeetSetupGuideDialog({ open, onOpenChange }: Props) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-school-portal.com";
  const redirectUri = `${origin}/admin/online-learning/oauth/callback`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,900px)] max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="h-5 w-5 text-primary" />
            Google Meet setup guide
          </DialogTitle>
          <DialogDescription className="text-left pt-1">
            Each school in EduManage connects its <strong>own</strong> Google Cloud project and
            Google Workspace account. Follow these steps once per school — credentials are stored
            securely for your school only.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain modal-scrollbar px-6 py-4">
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
              <p className="font-medium">Before you start</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Use a Google account that can manage your school&apos;s Google Workspace (or a personal Gmail for testing).</li>
                <li>Allow about 20–30 minutes for first-time setup.</li>
                <li>While the app is in <strong>Testing</strong> mode, only emails you add as <strong>Test users</strong> can connect.</li>
              </ul>
            </div>

            <Accordion type="multiple" defaultValue={["step-1", "step-2", "step-5"]} className="w-full">
              <AccordionItem value="step-1">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">1</Badge>
                    Create a Google Cloud project (per school)
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Open the{" "}
                      <ExtLink href={LINKS.cloudConsole}>Google Cloud Console</ExtLink> and sign in.
                    </li>
                    <li>
                      Click the project dropdown (top bar) → <strong>New project</strong> or use{" "}
                      <ExtLink href={LINKS.newProject}>Create project</ExtLink>.
                    </li>
                    <li>
                      Name it clearly, e.g. <code className="text-xs bg-muted px-1 rounded">EduManage — Your School Name</code>.
                    </li>
                    <li>Create the project and <strong>select it</strong> in the top bar before continuing.</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step-2">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">2</Badge>
                    Enable Google Calendar API
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Open{" "}
                      <ExtLink href={LINKS.calendarApi}>Google Calendar API</ExtLink> (while your
                      school project is selected).
                    </li>
                    <li>
                      Click <strong>Enable</strong>. Wait until status shows <strong>Enabled</strong>.
                    </li>
                    <li>Live classes use Calendar API to create events with Meet links — this step is required.</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step-3">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    Configure OAuth consent screen
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Go to{" "}
                      <ExtLink href={LINKS.oauthConsent}>OAuth consent screen</ExtLink> →{" "}
                      <strong>Edit app</strong> (or configure if new).
                    </li>
                    <li>
                      <strong>App information</strong> — set <strong>App name</strong> to{" "}
                      <code className="text-xs bg-muted px-1 rounded">EduManage</code>.
                    </li>
                    <li>
                      <strong>User support email</strong> and <strong>Developer contact</strong> — use
                      your school admin email.
                    </li>
                    <li>
                      <strong>Audience</strong> — choose <strong>External</strong> (typical for schools)
                      unless you are a Google Workspace org using Internal only.
                    </li>
                    <li>
                      <strong>Publishing status</strong> — leave the app in <strong>Testing</strong>. You
                      do not need home page, privacy, or terms URLs while testing.
                    </li>
                    <li>
                      <strong>Scopes</strong> → Add or remove scopes → enable all of:
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>
                          <code className="text-xs">.../auth/calendar</code> — manage calendars &amp;
                          Meet events
                        </li>
                        <li>
                          <code className="text-xs">openid</code>
                        </li>
                        <li>
                          <code className="text-xs">.../auth/userinfo.email</code>
                        </li>
                        <li>
                          <code className="text-xs">.../auth/userinfo.profile</code>
                        </li>
                      </ul>
                    </li>
                    <li>
                      <strong>Test users</strong> (required while in Testing) — add every Google account
                      that will connect or host live classes, e.g. your admin and teacher emails.
                    </li>
                    <li>Save through all steps until you reach the summary.</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step-4">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">4</Badge>
                    Create OAuth client credentials
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Open{" "}
                      <ExtLink href={LINKS.credentials}>Credentials</ExtLink> →{" "}
                      <strong>Create credentials</strong> → <strong>OAuth client ID</strong>.
                    </li>
                    <li>
                      Application type: <strong>Web application</strong>.
                    </li>
                    <li>
                      Name: e.g. <code className="text-xs bg-muted px-1 rounded">EduManage Web Client</code>.
                    </li>
                    <li>
                      Under <strong>Authorized redirect URIs</strong>, add exactly:
                      <div className="mt-3 not-prose">
                        <CopyBlock label="Redirect URI (required)" value={redirectUri} />
                      </div>
                      <p className="mt-2 text-xs">
                        For local development also add:{" "}
                        <code className="bg-muted px-1 rounded">
                          http://localhost:8080/admin/online-learning/oauth/callback
                        </code>
                      </p>
                    </li>
                    <li>
                      Click <strong>Create</strong>. Copy the <strong>Client ID</strong> and{" "}
                      <strong>Client secret</strong> — you will paste them into EduManage next.
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step-5">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">5</Badge>
                    Connect in EduManage (this school)
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      On this <strong>Online Learning</strong> page, scroll to the{" "}
                      <strong>Google Workspace</strong> card.
                    </li>
                    <li>
                      Paste your <strong>Client ID</strong>, <strong>Client Secret</strong>, and confirm
                      the <strong>Redirect URI</strong> matches the value above.
                    </li>
                    <li>
                      Click <strong>Save Google credentials</strong> (stored only for your school).
                    </li>
                    <li>
                      Click <strong>Connect Google Account</strong> and sign in with the Google account
                      that will create Meet links (often the school admin or IT account).
                    </li>
                    <li>
                      Approve <strong>Calendar</strong> and <strong>email</strong> permissions on the
                      Google screen.
                    </li>
                    <li>
                      If you see <strong>Calendar permission missing</strong>, click{" "}
                      <strong>Disconnect</strong> → <strong>Connect</strong> again after fixing scopes.
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step-6">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">6</Badge>
                    Create your first live class
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Ask a teacher to open <strong>Live Classes</strong> (or you can test as admin on
                      upcoming sessions).
                    </li>
                    <li>
                      Click <strong>Create Live Class</strong>, fill class, subject, date, and time.
                    </li>
                    <li>
                      Submit — EduManage creates a Google Calendar event with a Meet link for your school.
                    </li>
                    <li>
                      Students click <strong>Join in portal</strong>. Google Meet opens in a separate
                      window (Google does not allow embedding Meet inside other sites).
                    </li>
                    <li>Keep the EduManage tab open for resources and attendance.</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="troubleshooting">
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">Help</Badge>
                    Troubleshooting
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
                  <ul className="space-y-3">
                    <li>
                      <strong>access_denied</strong> — Add the Google account under OAuth consent screen →
                      Test users.
                    </li>
                    <li>
                      <strong>insufficient authentication scopes</strong> — Add calendar, openid, email,
                      profile scopes; Disconnect and Connect again in EduManage.
                    </li>
                    <li>
                      <strong>Calendar API has not been used or is disabled</strong> — Enable Calendar API
                      in step 2; wait 1–2 minutes.
                    </li>
                    <li>
                      <strong>redirect_uri_mismatch</strong> — Redirect URI in Google must match EduManage
                      exactly (including https and path).
                    </li>
                    <li>
                      <strong>meet.google.com refused to connect</strong> — Normal; use{" "}
                      <strong>Join in portal</strong> and allow pop-ups for Meet.
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
