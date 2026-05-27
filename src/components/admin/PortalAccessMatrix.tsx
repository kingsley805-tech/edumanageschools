import { Fragment } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PORTAL_ACCESS_ACTIONS,
  type PageAccessState,
  type PortalAccessAction,
  type PortalPageDef,
} from "@/lib/portalPageAccess";

type Props = {
  pages: PortalPageDef[];
  access: PageAccessState;
  disabled?: boolean;
  onChange: (pageKey: string, action: PortalAccessAction, checked: boolean) => void;
};

const ACTION_LABELS: Record<PortalAccessAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  manage: "Manage",
};

export function PortalAccessMatrix({ pages, access, disabled, onChange }: Props) {
  const sections = [...new Set(pages.map((p) => p.section))];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Portal page</th>
            {PORTAL_ACCESS_ACTIONS.map((action) => (
              <th key={action} className="px-3 py-3 text-center font-semibold text-muted-foreground">
                {ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section}>
              <tr className="bg-muted/30">
                <td colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {section}
                </td>
              </tr>
              {pages
                .filter((p) => p.section === section)
                .map((page) => (
                  <tr key={page.key} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{page.label}</div>
                      <div className="text-xs text-muted-foreground">{page.path}</div>
                    </td>
                    {PORTAL_ACCESS_ACTIONS.map((action) => {
                      const hasPerm = !!page.permissions[action];
                      const noPermsDefined = !Object.values(page.permissions).some(Boolean);
                      const enabled = hasPerm || (action === "view" && noPermsDefined);
                      return (
                        <td key={action} className="px-3 py-3 text-center">
                          {enabled ? (
                            <Checkbox
                              checked={access[page.key]?.[action] ?? false}
                              disabled={disabled}
                              onCheckedChange={(c) => onChange(page.key, action, c === true)}
                              aria-label={`${page.label} ${ACTION_LABELS[action]}`}
                            />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
