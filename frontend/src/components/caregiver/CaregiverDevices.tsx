import { useMemo, useState } from "react";
import {
  Activity,
  Bluetooth,
  ChevronRight,
  Cpu,
  HeartPulse,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Wifi,
  Watch,
  Droplets,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SampleDevice = {
  id: string;
  name: string;
  brand: string;
  category: string;
  connectivity: string;
  dataPoints: string[];
  status: "available" | "connected";
};

const SAMPLE_DEVICES: SampleDevice[] = [
  {
    id: "dev-apple-watch",
    name: "Apple Watch Series",
    brand: "Apple",
    category: "Smartwatch",
    connectivity: "Bluetooth / HealthKit",
    dataPoints: ["Heart Rate", "SpO2", "Sleep"],
    status: "available",
  },
  {
    id: "dev-fitbit-charge",
    name: "Fitbit Charge",
    brand: "Fitbit",
    category: "Fitness Tracker",
    connectivity: "Bluetooth / Fitbit API",
    dataPoints: ["Heart Rate", "Activity", "Sleep"],
    status: "available",
  },
  {
    id: "dev-omron-bp",
    name: "Omron Blood Pressure Monitor",
    brand: "Omron",
    category: "Blood Pressure",
    connectivity: "Bluetooth",
    dataPoints: ["Systolic", "Diastolic", "Pulse"],
    status: "connected",
  },
  {
    id: "dev-accucheck",
    name: "Accu-Chek Instant",
    brand: "Roche",
    category: "Glucose Meter",
    connectivity: "Bluetooth",
    dataPoints: ["Blood Glucose"],
    status: "available",
  },
  {
    id: "dev-withings-scale",
    name: "Withings Smart Scale",
    brand: "Withings",
    category: "Weight Scale",
    connectivity: "Wi-Fi / Bluetooth",
    dataPoints: ["Weight", "BMI", "Body Composition"],
    status: "available",
  },
  {
    id: "dev-wellue-oximeter",
    name: "Wellue Pulse Oximeter",
    brand: "Wellue",
    category: "Oximeter",
    connectivity: "Bluetooth",
    dataPoints: ["SpO2", "Pulse Rate"],
    status: "available",
  },
];

const getDeviceIcon = (category: string) => {
  const value = category.toLowerCase();
  if (value.includes("smartwatch")) return Watch;
  if (value.includes("glucose")) return Droplets;
  if (value.includes("fitness")) return Activity;
  return HeartPulse;
};

const getStatusTone = (status: SampleDevice["status"]) => {
  if (status === "connected") {
    return {
      badge: "default" as const,
      ring: "ring-emerald-500/20",
      shell:
        "from-emerald-500/16 via-emerald-500/6 to-background dark:from-emerald-500/12 dark:via-emerald-500/5 dark:to-background",
      icon:
        "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400",
      glow: "bg-emerald-500/20",
      button: "default" as const,
    };
  }

  return {
    badge: "secondary" as const,
    ring: "ring-sky-500/20",
    shell:
      "from-sky-500/16 via-violet-500/6 to-background dark:from-sky-500/12 dark:via-violet-500/5 dark:to-background",
    icon:
      "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-400",
    glow: "bg-sky-500/20",
    button: "default" as const,
  };
};

const categories = ["All", ...Array.from(new Set(SAMPLE_DEVICES.map((d) => d.category)))];

export const CaregiverDevices = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(SAMPLE_DEVICES[0]?.id || "");

  const filteredDevices = useMemo(() => {
    const q = query.trim().toLowerCase();

    return SAMPLE_DEVICES.filter((device) => {
      const matchesCategory = activeCategory === "All" || device.category === activeCategory;
      const matchesQuery =
        !q ||
        device.name.toLowerCase().includes(q) ||
        device.brand.toLowerCase().includes(q) ||
        device.category.toLowerCase().includes(q) ||
        device.connectivity.toLowerCase().includes(q) ||
        device.dataPoints.some((point) => point.toLowerCase().includes(q));

      return matchesCategory && matchesQuery;
    });
  }, [query, activeCategory]);

  const selectedDevice = useMemo(() => {
    return filteredDevices.find((device) => device.id === selectedDeviceId) || filteredDevices[0] || SAMPLE_DEVICES[0];
  }, [filteredDevices, selectedDeviceId]);

  const stats = useMemo(() => {
    const connected = SAMPLE_DEVICES.filter((d) => d.status === "connected").length;
    const bluetooth = SAMPLE_DEVICES.filter((d) => d.connectivity.toLowerCase().includes("bluetooth")).length;
    const wifi = SAMPLE_DEVICES.filter((d) => d.connectivity.toLowerCase().includes("wi-fi")).length;
    return {
      total: SAMPLE_DEVICES.length,
      connected,
      available: SAMPLE_DEVICES.length - connected,
      bluetooth,
      wifi,
    };
  }, []);

  const handleConnect = (device: SampleDevice) => {
    toast({
      title: "Coming soon...",
      description: `${device.name} integration and configuration will be available soon.`,
    });
  };

  const featuredTone = selectedDevice ? getStatusTone(selectedDevice.status) : null;
  const FeaturedIcon = selectedDevice ? getDeviceIcon(selectedDevice.category) : Cpu;

  return (
    <div className="space-y-4">
      <Card className="care-card overflow-hidden border-border/70 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.2)]">
        <CardContent className="relative p-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/16 via-background to-background" />
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-primary/12 blur-3xl" />
          <div className="absolute left-8 top-8 h-20 w-20 rounded-full bg-sky-500/10 blur-2xl" />

          <div className="relative p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1 text-[10px] shadow-sm">
                    Device Intelligence
                  </Badge>
                  <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1 text-[10px] shadow-sm">
                    Preview Mode
                  </Badge>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_40px_-16px_rgba(99,102,241,0.65)]">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                      Care Device Integration Hub
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      Discover monitoring devices, preview supported health streams, and prepare future patient integrations from one unified workspace.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[520px]">
                <div className="rounded-2xl border border-border/60 bg-background/85 p-4 shadow-sm">
                  <p className="text-[11px] text-muted-foreground">Supported</p>
                  <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
                </div>
                <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/80 p-4 shadow-sm">
                  <p className="text-[11px] text-muted-foreground">Connected</p>
                  <p className="mt-1 text-2xl font-semibold">{stats.connected}</p>
                </div>
                <div className="rounded-2xl border border-sky-300/60 bg-sky-50/80 p-4 shadow-sm">
                  <p className="text-[11px] text-muted-foreground">Bluetooth</p>
                  <p className="mt-1 text-2xl font-semibold">{stats.bluetooth}</p>
                </div>
                <div className="rounded-2xl border border-violet-300/60 bg-violet-50/80 p-4 shadow-sm">
                  <p className="text-[11px] text-muted-foreground">Wi-Fi</p>
                  <p className="mt-1 text-2xl font-semibold">{stats.wifi}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[28px] border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-xl">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Explore device catalog</p>
                    <p className="text-xs text-muted-foreground">
                      Filter by category, search by brand or metric, and compare available integrations.
                    </p>
                  </div>

                  <div className="relative w-full lg:w-[280px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search devices, brands, metrics..."
                      className="h-10 rounded-2xl border-border/60 bg-background/90 pl-10 shadow-sm"
                    />
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        activeCategory === category
                          ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                          : "border-border/60 bg-background/80 text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredDevices.map((device) => {
                    const Icon = getDeviceIcon(device.category);
                    const tone = getStatusTone(device.status);
                    const isSelected = selectedDevice?.id === device.id;

                    return (
                      <button
                        key={device.id}
                        type="button"
                        onClick={() => setSelectedDeviceId(device.id)}
                        className={cn(
                          "relative overflow-hidden rounded-[24px] border bg-gradient-to-br p-[1px] text-left shadow-sm transition-all duration-300",
                          tone.shell,
                          isSelected
                            ? `scale-[1.01] ring-4 ${tone.ring}`
                            : "hover:-translate-y-0.5 hover:shadow-md",
                        )}
                      >
                        <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-80 ${tone.glow}" />
                        <div className="relative rounded-[23px] bg-card/92 p-4 backdrop-blur-xl">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border", tone.icon)}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{device.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {device.brand} · {device.category}
                                </p>
                              </div>
                            </div>

                            <Badge
                              variant={device.status === "connected" ? "default" : "secondary"}
                              className="rounded-full text-[10px]"
                            >
                              {device.status === "connected" ? "Connected" : "Available"}
                            </Badge>
                          </div>

                          <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {device.connectivity.toLowerCase().includes("wi-fi") ? (
                              <Wifi className="h-3.5 w-3.5" />
                            ) : (
                              <Bluetooth className="h-3.5 w-3.5" />
                            )}
                            <span className="truncate">{device.connectivity}</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {device.dataPoints.slice(0, 3).map((metric) => (
                              <Badge key={metric} variant="outline" className="rounded-full text-[10px]">
                                <HeartPulse className="mr-1 h-3 w-3" />
                                {metric}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {filteredDevices.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    No devices matched your search.
                  </div>
                ) : null}
              </div>

              {selectedDevice ? (
                <div className="rounded-[28px] border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-xl">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Featured integration</p>
                      <p className="text-xs text-muted-foreground">
                        A focused preview of one selected device
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "relative overflow-hidden rounded-[28px] border bg-gradient-to-br p-[1px] shadow-sm",
                      featuredTone?.shell,
                    )}
                  >
                    <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl", featuredTone?.glow)} />
                    <div className="relative rounded-[27px] bg-card/94 p-5 backdrop-blur-xl">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", featuredTone?.icon)}>
                            <FeaturedIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-semibold">{selectedDevice.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedDevice.brand} · {selectedDevice.category}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant={selectedDevice.status === "connected" ? "default" : "secondary"}
                          className="rounded-full"
                        >
                          {selectedDevice.status === "connected" ? "Connected" : "Available"}
                        </Badge>
                      </div>

                      <div className="mb-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-border/60 bg-background/85 p-3 shadow-sm">
                          <p className="text-[11px] text-muted-foreground">Connectivity</p>
                          <p className="mt-1 text-sm font-semibold">{selectedDevice.connectivity}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/85 p-3 shadow-sm">
                          <p className="text-[11px] text-muted-foreground">Health Streams</p>
                          <p className="mt-1 text-sm font-semibold">{selectedDevice.dataPoints.length}</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Captured health signals
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedDevice.dataPoints.map((metric) => (
                            <Badge
                              key={metric}
                              variant="outline"
                              className="rounded-full border-border/60 bg-background/80 px-3 py-1 text-[11px]"
                            >
                              <HeartPulse className="mr-1.5 h-3 w-3" />
                              {metric}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="mb-5 rounded-2xl border border-emerald-300/40 bg-emerald-50/70 p-3 shadow-sm">
                        <div className="flex items-start gap-2">
                          <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-700" />
                          <div>
                            <p className="text-sm font-semibold text-emerald-900">
                              Integration readiness
                            </p>
                            <p className="text-xs text-emerald-800/80">
                              This preview suggests where secure pairing, data permission mapping, and patient-level linking will appear in the future workflow.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          className="h-10 flex-1 rounded-2xl shadow-sm"
                          onClick={() => handleConnect(selectedDevice)}
                        >
                          <Plus className="mr-1.5 h-4 w-4" />
                          Connect Device
                        </Button>

                        <Button
                          variant="outline"
                          className="h-10 rounded-2xl border-border/60 bg-background/85 shadow-sm"
                          onClick={() => handleConnect(selectedDevice)}
                        >
                          View Setup Flow
                          <ChevronRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CaregiverDevices;