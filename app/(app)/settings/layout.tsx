import { SettingsSubpageShell } from "@/components/settings/SettingsSubpageShell";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsSubpageShell>{children}</SettingsSubpageShell>;
}
