import type { ReactNode } from "react";
import { NAV_ITEMS, type Workspace } from "../navigation";
import { cx } from "../utils/cx";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  children: ReactNode;
  workspace: Workspace;
  supabaseConnected: boolean;
  supabaseState: string;
  onWorkspaceChange: (workspace: Workspace) => void;
};

export function AppShell({ children, workspace, supabaseConnected, supabaseState, onWorkspaceChange }: AppShellProps) {
  const active = NAV_ITEMS.find((item) => item.id === workspace) ?? NAV_ITEMS[0];

  return (
    <div className="appShell">
      <Sidebar
        navItems={NAV_ITEMS}
        workspace={workspace}
        supabaseConnected={supabaseConnected}
        supabaseState={supabaseState}
        onWorkspaceChange={onWorkspaceChange}
      />

      <div className="mainColumn">
        <header className="topBar">
          <div>
            <p className="kicker">{active.eyebrow}</p>
            <h1>{active.label}</h1>
          </div>
          <div className="topActions">
            <button className="button ghost">Command</button>
            <button className="button primary">New Campaign</button>
          </div>
        </header>

        <main className={cx("contentArea", `workspace-${workspace}`)}>{children}</main>
      </div>

      <MobileNav navItems={NAV_ITEMS} workspace={workspace} onWorkspaceChange={onWorkspaceChange} />
    </div>
  );
}
