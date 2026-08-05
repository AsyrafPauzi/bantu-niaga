import type { ReactNode } from "react";
import {
  ModuleListPanel,
  ModuleListPanelHeader,
  ModuleListRow,
} from "@/components/dashboard/module-list-panel";

interface AdminOverviewPanelProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AdminOverviewPanel({
  title,
  subtitle,
  action,
  children,
  className,
}: AdminOverviewPanelProps) {
  return (
    <ModuleListPanel as="section" className={className}>
      <ModuleListPanelHeader
        title={title}
        subtitle={subtitle}
        action={action}
      />
      {children}
    </ModuleListPanel>
  );
}

export const AdminOverviewRow = ModuleListRow;
