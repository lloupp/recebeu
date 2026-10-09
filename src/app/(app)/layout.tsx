import { AppShell } from "@/components/app-shell";
import { getCurrentOrganization } from "@/lib/auth";
import { isLocalMode } from "@/lib/storage-mode";

export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (isLocalMode) {
    return <AppShell organizationName="Minha empresa · banco local">{children}</AppShell>;
  }
  const { membership } = await getCurrentOrganization();
  const org = membership.organizations as unknown as { id: string; name: string };
  return <AppShell organizationName={org.name}>{children}</AppShell>;
}
