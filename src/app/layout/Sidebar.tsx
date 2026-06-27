import type { NavItem, Workspace } from "../navigation";
import { cx } from "../utils/cx";

type SidebarProps = {
  navItems: NavItem[];
  workspace: Workspace;
  supabaseConnected: boolean;
  supabaseState: string;
  onWorkspaceChange: (workspace: Workspace) => void;
};

export function Sidebar({ navItems, workspace, supabaseConnected, supabaseState, onWorkspaceChange }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brandBlock">
        <div className="brandMark">BS</div>
        <div>
          <div className="brandName">Brew Station</div>
          <div className="brandSub">Campaign command center</div>
        </div>
      </div>

      <nav className="sideNav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={cx("navButton", workspace === item.id && "isActive")}
            onClick={() => onWorkspaceChange(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.eyebrow}</small>
          </button>
        ))}
      </nav>

      <div className="sidebarFooter">
        <span className={cx("statusDot", supabaseConnected ? "good" : "warn")} />
        <span>Supabase: {supabaseState}</span>
      </div>
    </aside>
  );
}
