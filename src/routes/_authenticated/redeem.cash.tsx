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
import { requestCashOut } from "@/lib/campoints.functions";
import { POINTS_PER_NAIRA, MIN_CASHOUT_POINTS, formatPoints } from "@/lib/campoints";

export const Route = createFileRoute("/_authenticated/redeem/cash")({
  component: CashPage,
});

// Compact bank list — extend as needed.
const BANKS: { code: string; name: string }[] = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "GTBank" },
  { code: "057", name: "Zenith Bank" },
  { code: "011", name: "First Bank" },
  { code: "033", name: "United Bank for Africa" },
  { code: "232", name: "Sterling Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "999", name: "Opay" },
  { code: "998", name: "Palmpay" },
  { code: "997", name: "Kuda" },
  { code: "996", name: "Moniepoint" },
];

function CashPage() {
  const [amount, setAmount] = useState(1000);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fn = useServerFn(requestCashOut);

  const submit = useMutation({
    mutationFn: async () => fn({ data: { amountNaira: amount, bankCode, accountNumber, accountName } }),
    onSuccess: () => {
      toast.success("Cash-out requested — we'll process it within 24 hours.");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      navigate({ to: "/wallet" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const points = amount * POINTS_PER_NAIRA;
  const valid = bankCode && /^\d{10}$/.test(accountNumber) && accountName.length > 2 && amount >= MIN_CASHOUT_POINTS / POINTS_PER_NAIRA;

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl">Cash out</h1>
        <p className="mt-1 text-sm text-muted-foreground">Withdraw to any Nigerian bank or fintech. Minimum ₦{MIN_CASHOUT_POINTS / POINTS_PER_NAIRA}.</p>

        <div className="mt-6 space-y-4">
          <div>
            <Label>Amount (₦)</Label>
            <Input type="number" min={1000} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <p className="mt-1 text-xs text-muted-foreground">{formatPoints(points)} Campoints</p>
          </div>
          <div>
            <Label>Bank</Label>
            <Select value={bankCode} onValueChange={setBankCode}>
              <SelectTrigger><SelectValue placeholder="Pick your bank" /></SelectTrigger>
              <SelectContent>{BANKS.map((b) => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="acc">Account number</Label>
            <Input id="acc" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <Label htmlFor="name">Account name (as on your statement)</Label>
            <Input id="name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </div>

          <Button disabled={!valid || submit.isPending} onClick={() => submit.mutate()} className="w-full brand-gradient text-primary-foreground">
            {submit.isPending ? "Submitting…" : `Withdraw ₦${formatPoints(amount)}`}
          </Button>
          <p className="text-xs text-muted-foreground">First cash-outs are manually reviewed for safety (24h). Provider auto-payouts coming soon.</p>
        </div>
      </div>
    </AppShell>
  );
}
