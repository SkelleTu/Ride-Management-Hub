import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { UPcarLogo } from "@/components/ui/UPcarLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-6 bg-background p-4">
      <UPcarLogo size={64} />
      <div className="text-center space-y-2">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-xl font-semibold">Página não encontrada</p>
        <p className="text-muted-foreground text-sm">A rota que você acessou não existe.</p>
      </div>
      <Button asChild>
        <Link href="/">Voltar para o início</Link>
      </Button>
    </div>
  );
}
