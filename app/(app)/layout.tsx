import { AdaptiveShell } from "@/components/shells/adaptive-shell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdaptiveShell>{children}</AdaptiveShell>;
}
