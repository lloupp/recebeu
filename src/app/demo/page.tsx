import Link from "next/link";
import { DemoRecebeu } from "@/components/demo-recebeu";

export const metadata = {
  title: "Recebeu | Demonstração com dados fictícios",
  description: "Experimente o fluxo de contas a receber com dados de exemplo, sem cadastro ou pagamentos reais.",
};

export default function DemoPage() {
  return (
    <main className="demo-layout">
      <header className="demo-header">
        <div>
          <div className="demo-brand">Recebeu</div>
          <p className="muted">Gestão de recebíveis para pequenas empresas</p>
        </div>
        <Link href="/" className="button secondary">Página inicial</Link>
      </header>
      <DemoRecebeu />
    </main>
  );
}
