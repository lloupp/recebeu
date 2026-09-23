import { AppShell } from "@/components/app-shell";
import { getCurrentOrganization } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { membership } = await getCurrentOrganization();
  const org = membership.organizations as unknown as { id: string; name: string };
  return <AppShell organizationName={org.name}>{children}</AppShell>;
}
