import type { NavItem, Workspace } from "../navigation";
import { cx } from "../utils/cx";

type MobileNavProps = {
  navItems: NavItem[];
  workspace: Workspace;
  onWorkspaceChange: (workspace: Workspace) => void;
};

export function MobileNav({ navItems, workspace, onWorkspaceChange }: MobileNavProps) {
  return (
    <nav className="mobileNav" aria-label="Mobile navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={cx("mobileNavButton", workspace === item.id && "isActive")}
          onClick={() => onWorkspaceChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
