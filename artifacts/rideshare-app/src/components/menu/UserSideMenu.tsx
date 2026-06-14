import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { usePreferences, FontSize, Theme } from "@/lib/preferences";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Menu, Star, Car, User, Shield, Search, LogOut, Sun, Moon,
  Type, Eye, Info, ChevronRight, MapPin, Calendar, Phone,
  Mail, Hash, Clock, CheckCircle, XCircle, X, Camera, ImageIcon, Loader2, Pencil,
} from "lucide-react";
import {
  useListDrivers, getListDriversQueryKey, ListDriversStatus,
  useListUsers, getListUsersQueryKey, ListUsersRole,
} from "@workspace/api-client-react";
import type { User as UserType, DriverProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

async function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 240;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  passenger: { label: "Passageiro", color: "bg-blue-500/20 text-blue-400" },
  driver: { label: "Motorista", color: "bg-accent/20 text-accent" },
  admin: { label: "Admin", color: "bg-primary/20 text-primary" },
};

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Grande" },
  { value: "xlarge", label: "Maior" },
];

function StarRating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(value) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
      ))}
      <span className="ml-1 text-xs font-medium">{value.toFixed(1)}</span>
    </span>
  );
}

function ProfileCard({ user }: { user: UserType }) {
  const { login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const roleInfo = ROLE_LABELS[user.role] ?? { label: user.role, color: "" };

  const handlePhotoFile = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressPhoto(file);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users/me/avatar", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ avatarUrl: compressed }),
      });
      if (!res.ok) throw new Error("Erro ao salvar foto");
      const updated = await res.json();
      login(token!, { ...updated });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Foto atualizada com sucesso!" });
    } catch {
      toast({ title: "Erro ao atualizar foto", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handlePhotoFile(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl">
      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleChange} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

      <div className="relative shrink-0">
        <Avatar className="w-16 h-16">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} className="object-cover" />
          <AvatarFallback className={`text-lg font-bold ${roleInfo.color}`}>{user.name.charAt(0)}</AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
        {!uploading && (
          <div className="absolute -bottom-1 -right-1 flex gap-0.5">
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-background"
              title="Tirar foto"
            >
              <Camera className="w-3 h-3 text-primary-foreground" />
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center shadow-md"
              title="Escolher da galeria"
            >
              <ImageIcon className="w-3 h-3 text-foreground" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-base truncate">{user.name}</div>
        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        <div className="flex items-center gap-2 mt-1">
          <Badge className={`text-xs px-2 py-0 ${roleInfo.color}`}>{roleInfo.label}</Badge>
          {user.rating != null && <StarRating value={user.rating} />}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Toque nos ícones para trocar a foto</p>
      </div>
    </div>
  );
}

function StatsSection({ user }: { user: UserType }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-secondary/50 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-primary">{user.totalRides ?? 0}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Corridas</div>
      </div>
      <div className="bg-secondary/50 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-yellow-400">{user.rating != null ? user.rating.toFixed(1) : "—"}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Avaliação</div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground text-xs">{label}:</span>
      <span className="font-medium text-xs truncate">{value}</span>
    </div>
  );
}

function calcAge(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} anos`;
}

function DriverProfileModal({ driver, onClose }: { driver: DriverProfile; onClose: () => void }) {
  const user = driver.user;
  const statusConfig: Record<string, { label: string; color: string; Icon: any }> = {
    pending: { label: "Em Análise", color: "text-yellow-400", Icon: Clock },
    approved: { label: "Aprovado", color: "text-green-400", Icon: CheckCircle },
    denied: { label: "Negado", color: "text-destructive", Icon: XCircle },
  };
  const cfg = statusConfig[driver.status] ?? statusConfig.pending;
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Perfil do Motorista</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-2">
            {user && (
              <div className="flex items-center gap-3">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} className="object-cover" />
                  <AvatarFallback className="text-lg font-bold">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-bold">{user.name}</div>
                  {user.rating != null && <StarRating value={user.rating} />}
                  <div className="text-xs text-muted-foreground">{user.totalRides ?? 0} corridas</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <cfg.Icon className={`w-4 h-4 ${cfg.color}`} />
              <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
            <Separator />
            {user && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados Pessoais</div>
                <InfoRow icon={User} label="Idade" value={calcAge(driver.birthDate)} />
                <InfoRow icon={MapPin} label="Cidade" value={`${driver.city ?? ""}${driver.state ? `, ${driver.state}` : ""}`} />
              </div>
            )}
            {user && <Separator />}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Veículo</div>
              <InfoRow icon={Car} label="Modelo" value={`${driver.vehicleMake} ${driver.vehicleModel} ${driver.vehicleYear}`} />
              <InfoRow icon={Hash} label="Placa" value={driver.vehiclePlate} />
              <InfoRow icon={Car} label="Tipo" value={driver.vehicleType} />
              <InfoRow icon={Car} label="Cor" value={driver.vehicleColor} />
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato</div>
              {user && <InfoRow icon={Mail} label="Email" value={user.email} />}
              {user && <InfoRow icon={Phone} label="Telefone" value={user.phone} />}
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Habilitação</div>
              <InfoRow icon={Hash} label="CNH" value={driver.cnhNumber} />
              <InfoRow icon={Calendar} label="Validade" value={driver.cnhExpiry} />
              <InfoRow icon={Car} label="Categoria" value={driver.cnhCategory} />
            </div>
            <InfoRow icon={Calendar} label="Membro desde" value={new Date(driver.createdAt).toLocaleDateString("pt-BR")} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function PassengerProfileModal({ passenger, onClose }: { passenger: UserType; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Perfil do Passageiro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14">
              <AvatarImage src={passenger.avatarUrl ?? undefined} alt={passenger.name} className="object-cover" />
              <AvatarFallback className="text-lg font-bold bg-blue-500/20 text-blue-400">{passenger.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-bold">{passenger.name}</div>
              {passenger.rating != null && <StarRating value={passenger.rating} />}
              <div className="text-xs text-muted-foreground">{passenger.totalRides ?? 0} corridas</div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <InfoRow icon={Mail} label="Email" value={passenger.email} />
            <InfoRow icon={Phone} label="Telefone" value={passenger.phone} />
            <InfoRow icon={Calendar} label="Membro desde" value={new Date(passenger.createdAt).toLocaleDateString("pt-BR")} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchSection({ currentUserRole }: { currentUserRole: string }) {
  const [query, setQuery] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<UserType | null>(null);

  const isPassengerOrAdmin = currentUserRole === "passenger" || currentUserRole === "admin";
  const isDriverOrAdmin = currentUserRole === "driver" || currentUserRole === "admin";

  const { data: drivers = [] } = useListDrivers(
    { search: query || undefined, status: ListDriversStatus.approved },
    {
      query: {
        queryKey: [...getListDriversQueryKey({ search: query || undefined, status: ListDriversStatus.approved }), "menu-search"],
        enabled: isPassengerOrAdmin && query.trim().length >= 2,
      }
    }
  );

  const { data: passengers = [] } = useListUsers(
    { role: ListUsersRole.passenger, search: query || undefined },
    {
      query: {
        queryKey: [...getListUsersQueryKey({ role: ListUsersRole.passenger, search: query || undefined }), "menu-search"],
        enabled: isDriverOrAdmin && query.trim().length >= 2,
      }
    }
  );

  const showDrivers = isPassengerOrAdmin && query.trim().length >= 2 && drivers.length > 0;
  const showPassengers = isDriverOrAdmin && query.trim().length >= 2 && passengers.length > 0;
  const noResults = query.trim().length >= 2 && !showDrivers && !showPassengers;

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Search className="w-4 h-4" />
        Buscar Perfis
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder={isPassengerOrAdmin ? "Buscar motoristas..." : "Buscar passageiros..."}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9 h-9 text-sm bg-secondary border-border"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {query.trim().length > 0 && query.trim().length < 2 && (
        <div className="text-xs text-muted-foreground text-center py-2">Digite pelo menos 2 caracteres</div>
      )}
      {noResults && (
        <div className="text-xs text-muted-foreground text-center py-3">Nenhum perfil encontrado</div>
      )}
      {showDrivers && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Motoristas</div>
          {drivers.slice(0, 8).map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDriver(d)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
            >
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarImage src={d.user?.avatarUrl ?? undefined} alt={d.user?.name ?? ""} className="object-cover" />
                <AvatarFallback className="text-xs font-bold bg-accent/20 text-accent">{d.user?.name?.charAt(0) ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.user?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{d.vehicleMake} {d.vehicleModel} · {d.vehiclePlate}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
      {showPassengers && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Passageiros</div>
          {passengers.slice(0, 8).map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPassenger(p)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
            >
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarImage src={p.avatarUrl ?? undefined} alt={p.name} className="object-cover" />
                <AvatarFallback className="text-xs font-bold bg-blue-500/20 text-blue-400">{p.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.totalRides ?? 0} corridas · {p.rating != null ? `⭐ ${p.rating.toFixed(1)}` : "Sem avaliação"}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
      {selectedDriver && <DriverProfileModal driver={selectedDriver} onClose={() => setSelectedDriver(null)} />}
      {selectedPassenger && <PassengerProfileModal passenger={selectedPassenger} onClose={() => setSelectedPassenger(null)} />}
    </div>
  );
}

function PreferencesSection() {
  const { fontSize, setFontSize, highContrast, setHighContrast, theme, setTheme } = usePreferences();
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="text-sm font-semibold text-foreground">Aparência</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>Tema {theme === "dark" ? "Escuro" : "Claro"}</span>
          </div>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={v => setTheme(v ? "dark" : "light")}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Type className="w-4 h-4" />
          Tamanho da Fonte
        </div>
        <div className="flex gap-2">
          {FONT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFontSize(opt.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                fontSize === opt.value
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccessibilitySection() {
  const { highContrast, setHighContrast } = usePreferences();
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Eye className="w-4 h-4" />
        Acessibilidade
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm">Alto Contraste</div>
        <Switch checked={highContrast} onCheckedChange={setHighContrast} />
      </div>
      <p className="text-xs text-muted-foreground">
        Aumenta o contraste de cores para melhor visibilidade.
      </p>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Info className="w-4 h-4" />
        Sobre o UPcar
      </div>
      <div className="bg-secondary/50 rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground">
        <div className="font-semibold text-foreground text-sm">UPcar</div>
        <p>Plataforma de corridas sob demanda que conecta passageiros e motoristas de forma transparente.</p>
        <div className="flex items-center justify-between pt-1">
          <span>Versão</span>
          <span className="text-foreground font-medium">1.0.0</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Contato</span>
          <span className="text-foreground font-medium">suporte@upcar.com.br</span>
        </div>
      </div>
    </div>
  );
}

export function UserSideMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const roleInfo = ROLE_LABELS[user.role] ?? { label: user.role, color: "" };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Menu className="w-5 h-5" />
            {user.avatarUrl && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background bg-primary" />
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 flex flex-col" style={{ width: '320px', minWidth: '320px' }}>
          <SheetHeader className="p-4 pb-0">
            <SheetTitle className="text-left text-base font-bold">Menu</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="space-y-5 pt-3">
              <ProfileCard user={user} />

              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalhes da Conta</div>
                <div className="space-y-1.5 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /><span>{user.phone}</span></div>
                  <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /><span className="truncate">{user.email}</span></div>
                  <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /><span>Membro desde {new Date(user.createdAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span></div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estatísticas</div>
                <StatsSection user={user} />
              </div>

              <Separator />

              <SearchSection currentUserRole={user.role} />

              <Separator />

              <PreferencesSection />

              <Separator />

              <AccessibilitySection />

              <Separator />

              <AboutSection />

              <Separator />

              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { setOpen(false); logout(); }}
              >
                <LogOut className="w-4 h-4" />
                Sair da conta
              </Button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
