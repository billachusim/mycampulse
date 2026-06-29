import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { redeemAirtime } from "@/lib/campoints.functions";
import { POINTS_PER_NAIRA, NETWORKS, formatPoints } from "@/lib/campoints";

export const Route = createFileRoute("/_authenticated/redeem/airtime")({
  component: AirtimePage,
});

const AMOUNTS = [100, 200, 500, 1000, 2000];

function AirtimePage() {
  const [network, setNetwork] = useState<string>("MTN");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(200);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fn = useServerFn(redeemAirtime);

  const submit = useMutation({
    mutationFn: async () => fn({ data: { network, phone, amountNaira: amount } }),
    onSuccess: () => {
      toast.success("Redemption queued — we'll text you when it lands.");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      navigate({ to: "/wallet" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const points = amount * POINTS_PER_NAIRA;

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl">Airtime / Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">Top up any Nigerian number. {POINTS_PER_NAIRA} Campoints = ₦1.</p>

        <div className="mt-6 space-y-4">
          <div>
            <Label>Network</Label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NETWORKS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" inputMode="numeric" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="08012345678" />
          </div>
          <div>
            <Label>Amount</Label>
            <div className="mt-1 grid grid-cols-5 gap-2">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className={`rounded-md border px-2 py-2 text-sm transition ${amount === a ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:bg-secondary"}`}
                >
                  ₦{a}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">You pay</span><span className="font-mono">{formatPoints(points)} Campoints</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">You get</span><span>₦{amount} {network} airtime</span></div>
          </div>

          <Button
            disabled={submit.isPending || !/^0\d{10}$/.test(phone)}
            className="w-full brand-gradient text-primary-foreground"
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Sending…" : "Confirm redemption"}
          </Button>
          <p className="text-xs text-muted-foreground">Provider goes live soon — redemptions are queued and processed by our team in the meantime.</p>
        </div>
      </div>
    </AppShell>
  );
}
