import Link from "next/link";
import type { ReactNode } from "react";

const items = [
  ["Dashboard", "/dashboard"],
  ["Recebíveis", "/receivables"],
  ["Clientes", "/customers"],
  ["Importações", "/imports"],
] as const;

export function AppShell({ children, organizationName }: { children: ReactNode; organizationName: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Recebeu</div>
        <nav className="nav">
          {items.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </aside>
      <main className="main">
        <header className="header">
          <div><strong>{organizationName}</strong><div className="muted">Contas a receber</div></div>
        </header>
        {children}
      </main>
    </div>
  );
}
