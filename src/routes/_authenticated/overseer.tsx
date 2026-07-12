import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/profile";
import { formatPoints } from "@/lib/campoints";
import {
  overseerCanEnter,
  overseerPulse,
  overseerListUsers,
  overseerGetUserDetail,
  overseerAdjustCampoints,
  overseerSetRole,
  overseerListPosts,
  overseerSetPostHidden,
  overseerDeletePost,
  overseerListComments,
  overseerDeleteComment,
  overseerListEvents,
  overseerSetEventStatus,
  overseerDeleteEvent,
  overseerListListings,
  overseerSetListingStatus,
  overseerDeleteListing,
  overseerListAmbassadors,
  overseerSetAmbassadorStatus,
  overseerListCampaigns,
  overseerSetCampaignActive,
  overseerListRedemptions,
  overseerSetRedemptionStatus,
  overseerListReports,
  overseerResolveReport,
  overseerListLedger,
  overseerListAudit,
} from "@/lib/overseer.functions";

export const Route = createFileRoute("/_authenticated/overseer")({
  beforeLoad: async () => {
    const res = await overseerCanEnter();
    if (!res.ok) throw redirect({ to: "/home" });
  },
  component: OverseerPage,
});

type Tab =
  | "pulse"
  | "users"
  | "posts"
  | "comments"
  | "events"
  | "listings"
  | "ambassadors"
  | "campaigns"
  | "redemptions"
  | "reports"
  | "ledger"
  | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "pulse", label: "Pulse" },
  { id: "users", label: "Users" },
  { id: "posts", label: "Posts" },
  { id: "comments", label: "Comments" },
  { id: "events", label: "Events" },
  { id: "listings", label: "Listings" },
  { id: "ambassadors", label: "Ambassadors" },
  { id: "campaigns", label: "Campaigns" },
  { id: "redemptions", label: "Redemptions" },
  { id: "reports", label: "Reports" },
  { id: "ledger", label: "Ledger" },
  { id: "audit", label: "Audit" },
];

function OverseerPage() {
  const [tab, setTab] = useState<Tab>("pulse");

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-3 py-4">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Overseer</h1>
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                Owner
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Global control for campulse. Every action here is logged.
            </p>
          </div>
          <Link to="/admin" className="text-xs text-muted-foreground underline">
            Regular admin →
          </Link>
        </header>

        <nav className="mb-4 flex flex-wrap gap-1 rounded-md border bg-card p-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded px-2.5 py-1.5 font-medium transition ${
                tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="rounded-md border bg-card p-3">
          {tab === "pulse" && <PulsePanel />}
          {tab === "users" && <UsersPanel />}
          {tab === "posts" && <PostsPanel />}
          {tab === "comments" && <CommentsPanel />}
          {tab === "events" && <EventsPanel />}
          {tab === "listings" && <ListingsPanel />}
          {tab === "ambassadors" && <AmbassadorsPanel />}
          {tab === "campaigns" && <CampaignsPanel />}
          {tab === "redemptions" && <RedemptionsPanel />}
          {tab === "reports" && <ReportsPanel />}
          {tab === "ledger" && <LedgerPanel />}
          {tab === "audit" && <AuditPanel />}
        </div>
      </div>
    </AppShell>
  );
}

// ---------- generic UI atoms ----------
function Row({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-2 border-b py-2 last:border-b-0">{children}</li>;
}
function Meta({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-muted-foreground">{children}</span>;
}
function Empty({ label }: { label: string }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{label}</p>;
}

function useCursorList<T extends { created_at: string }>(
  key: unknown[],
  fetcher: (input: { cursor?: string | null }) => Promise<T[]>,
  extra: Record<string, unknown> = {},
) {
  const [pages, setPages] = useState<T[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);

  const load = async (reset = false) => {
    setLoading(true);
    try {
      const rows = await fetcher({ cursor: reset ? null : cursor, ...extra });
      if (reset) {
        setPages([rows]);
      } else {
        setPages((p) => [...p, rows]);
      }
      const last = rows[rows.length - 1];
      setCursor(last ? last.created_at : null);
      setInitial(false);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => {
    void load(true);
  });

  const all = pages.flat();
  const canLoadMore = pages.length > 0 && pages[pages.length - 1].length >= 10;
  return { rows: all, loading, initial, canLoadMore, loadMore: () => load(false), reload: () => load(true), key };
}

// ---------- Pulse ----------
function PulsePanel() {
  const q = useQuery({ queryKey: ["overseer-pulse"], queryFn: () => overseerPulse(), staleTime: 30_000 });
  const d = q.data;
  const items = [
    { label: "New users (24h)", value: d?.users24h ?? 0 },
    { label: "New posts (24h)", value: d?.posts24h ?? 0 },
    { label: "Active campaigns", value: d?.activeCampaigns ?? 0 },
    { label: "Open reports", value: d?.openReports ?? 0 },
    { label: "Pending redemptions", value: d?.pendingRedemptions ?? 0 },
    { label: "Total users", value: d?.totalUsers ?? 0 },
  ];
  return (
    <div>
      <div className="mb-2 flex justify-between">
        <h2 className="text-sm font-semibold">Pulse</h2>
        <Button variant="outline" size="sm" onClick={() => q.refetch()}>
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="rounded border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">{it.label}</div>
            <div className="text-lg font-bold">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Users ----------
function UsersPanel() {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["overseer-users", q, cursor],
    queryFn: () => overseerListUsers({ data: { q, cursor } }),
    staleTime: 30_000,
  });
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Input placeholder="Search name or handle…" value={q} onChange={(e) => { setQ(e.target.value); setCursor(null); }} className="h-8 text-xs" />
        <Button size="sm" variant="outline" onClick={() => list.refetch()}>Search</Button>
      </div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="No users." /> : (
        <ul>
          {(list.data ?? []).map((u) => (
            <Row key={u.id}>
              <div className="flex-1">
                <button className="text-left" onClick={() => setSelected(u.id)}>
                  <div className="text-sm font-medium">{u.display_name ?? "—"}</div>
                  <Meta>@{u.handle ?? u.id.slice(0, 6)} · joined {timeAgo(u.created_at)}</Meta>
                </button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(u.id)}>Manage</Button>
            </Row>
          ))}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>
          Load older
        </Button>
      )}
      {selected && <UserSheet userId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["overseer-user", userId], queryFn: () => overseerGetUserDetail({ data: { userId } }) });
  const [delta, setDelta] = useState<number>(0);
  const [note, setNote] = useState("");

  const adjust = useMutation({
    mutationFn: useServerFn(overseerAdjustCampoints),
    onSuccess: () => { toast.success("Balance adjusted"); qc.invalidateQueries({ queryKey: ["overseer-user", userId] }); setDelta(0); setNote(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setRole = useMutation({
    mutationFn: useServerFn(overseerSetRole),
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["overseer-user", userId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const roles = q.data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isMod = roles.includes("moderator");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4" onClick={onClose}>
      <div className="mx-auto max-w-md rounded-lg bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex justify-between">
          <h3 className="text-sm font-semibold">User</h3>
          <button className="text-xs text-muted-foreground" onClick={onClose}>Close</button>
        </div>
        {q.isLoading || !q.data ? <Empty label="Loading…" /> : (
          <>
            <div className="mb-3 text-sm">
              <div className="font-medium">{q.data.profile?.display_name}</div>
              <Meta>@{q.data.profile?.handle} · balance {formatPoints(q.data.balance?.balance ?? 0)} pts</Meta>
              <div className="mt-1 flex gap-1 text-[11px]">
                {roles.length ? roles.map((r) => <span key={r} className="rounded bg-muted px-1.5 py-0.5">{r}</span>) : <span className="text-muted-foreground">no roles</span>}
              </div>
            </div>
            <div className="mb-3 rounded border p-2">
              <div className="mb-1 text-xs font-semibold">Adjust points</div>
              <div className="flex gap-2">
                <Input type="number" className="h-8 text-xs" value={delta} onChange={(e) => setDelta(parseInt(e.target.value) || 0)} />
                <Button size="sm" onClick={() => adjust.mutate({ data: { userId, delta, note: note || undefined } })} disabled={!delta || adjust.isPending}>Apply</Button>
              </div>
              <Textarea placeholder="Reason (optional)" className="mt-2 text-xs" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
            <div className="rounded border p-2">
              <div className="mb-1 text-xs font-semibold">Roles</div>
              <div className="flex gap-2">
                <Button size="sm" variant={isAdmin ? "destructive" : "outline"} onClick={() => setRole.mutate({ data: { userId, role: "admin", grant: !isAdmin } })}>
                  {isAdmin ? "Revoke admin" : "Grant admin"}
                </Button>
                <Button size="sm" variant={isMod ? "destructive" : "outline"} onClick={() => setRole.mutate({ data: { userId, role: "moderator", grant: !isMod } })}>
                  {isMod ? "Revoke mod" : "Grant mod"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- generic paged list panel factory ----------
function useCursorQuery<T>(key: unknown[], fetcher: () => Promise<T[]>) {
  return useQuery({ queryKey: key, queryFn: fetcher, staleTime: 30_000 });
}

// ---------- Posts ----------
function PostsPanel() {
  const qc = useQueryClient();
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-posts", hiddenOnly, cursor], () => overseerListPosts({ data: { cursor, hiddenOnly } }));
  const setHidden = useMutation({ mutationFn: useServerFn(overseerSetPostHidden), onSuccess: () => qc.invalidateQueries({ queryKey: ["overseer-posts"] }) });
  const del = useMutation({ mutationFn: useServerFn(overseerDeletePost), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["overseer-posts"] }); } });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs"><input type="checkbox" checked={hiddenOnly} onChange={(e) => { setHiddenOnly(e.target.checked); setCursor(null); }} /> Hidden only</label>
        <Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button>
      </div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="No posts." /> : (
        <ul>
          {(list.data ?? []).map((p) => {
            const author = Array.isArray(p.author) ? p.author[0] : p.author;
            return (
              <Row key={p.id}>
                <div className="flex-1">
                  <div className="line-clamp-2 text-sm">{p.body}</div>
                  <Meta>{author?.display_name ?? "unknown"} · {p.like_count}♥ {p.comment_count}💬 · {timeAgo(p.created_at)} {p.hidden && "· HIDDEN"}</Meta>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => setHidden.mutate({ data: { postId: p.id, hidden: !p.hidden } })}>{p.hidden ? "Unhide" : "Hide"}</Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete post?")) del.mutate({ data: { postId: p.id } }); }}>Delete</Button>
                </div>
              </Row>
            );
          })}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}

// ---------- Comments ----------
function CommentsPanel() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-comments", cursor], () => overseerListComments({ data: { cursor } }));
  const del = useMutation({ mutationFn: useServerFn(overseerDeleteComment), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["overseer-comments"] }); } });
  return (
    <div>
      <div className="mb-2 flex justify-end"><Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button></div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="No comments." /> : (
        <ul>
          {(list.data ?? []).map((c) => {
            const author = Array.isArray(c.author) ? c.author[0] : c.author;
            return (
              <Row key={c.id}>
                <div className="flex-1">
                  <div className="line-clamp-2 text-sm">{c.body}</div>
                  <Meta>{author?.display_name ?? "unknown"} · {timeAgo(c.created_at)}</Meta>
                </div>
                <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete comment?")) del.mutate({ data: { commentId: c.id } }); }}>Delete</Button>
              </Row>
            );
          })}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}

// ---------- Events ----------
function EventsPanel() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-events", cursor], () => overseerListEvents({ data: { cursor } }));
  const setStatus = useMutation({ mutationFn: useServerFn(overseerSetEventStatus), onSuccess: () => qc.invalidateQueries({ queryKey: ["overseer-events"] }) });
  const del = useMutation({ mutationFn: useServerFn(overseerDeleteEvent), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["overseer-events"] }); } });
  return (
    <div>
      <div className="mb-2 flex justify-end"><Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button></div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="No events." /> : (
        <ul>
          {(list.data ?? []).map((e) => {
            const host = Array.isArray(e.host) ? e.host[0] : e.host;
            return (
              <Row key={e.id}>
                <div className="flex-1">
                  <div className="text-sm font-medium">{e.title}</div>
                  <Meta>{host?.display_name} · {e.status} · {e.rsvp_count} rsvps · {timeAgo(e.created_at)}</Meta>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ data: { eventId: e.id, status: e.status === "cancelled" ? "published" : "cancelled" } })}>
                    {e.status === "cancelled" ? "Restore" : "Cancel"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete event?")) del.mutate({ data: { eventId: e.id } }); }}>Delete</Button>
                </div>
              </Row>
            );
          })}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}

// ---------- Listings ----------
function ListingsPanel() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-listings", cursor], () => overseerListListings({ data: { cursor } }));
  const setStatus = useMutation({ mutationFn: useServerFn(overseerSetListingStatus), onSuccess: () => qc.invalidateQueries({ queryKey: ["overseer-listings"] }) });
  const del = useMutation({ mutationFn: useServerFn(overseerDeleteListing), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["overseer-listings"] }); } });
  return (
    <div>
      <div className="mb-2 flex justify-end"><Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button></div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="No listings." /> : (
        <ul>
          {(list.data ?? []).map((l) => {
            const seller = Array.isArray(l.seller) ? l.seller[0] : l.seller;
            return (
              <Row key={l.id}>
                <div className="flex-1">
                  <div className="text-sm font-medium">{l.title}</div>
                  <Meta>₦{l.price_naira.toLocaleString()} · {l.category} · {l.status} · {seller?.display_name} · {timeAgo(l.created_at)}</Meta>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ data: { listingId: l.id, status: l.status === "unlisted" ? "active" : "unlisted" } })}>
                    {l.status === "unlisted" ? "Relist" : "Unlist"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete listing?")) del.mutate({ data: { listingId: l.id } }); }}>Delete</Button>
                </div>
              </Row>
            );
          })}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}

// ---------- Ambassadors ----------
function AmbassadorsPanel() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-ambassadors", cursor], () => overseerListAmbassadors({ data: { cursor } }));
  const setStatus = useMutation({ mutationFn: useServerFn(overseerSetAmbassadorStatus), onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["overseer-ambassadors"] }); } });
  return (
    <div>
      <div className="mb-2 flex justify-end"><Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button></div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="No ambassadors." /> : (
        <ul>
          {(list.data ?? []).map((a) => {
            const user = Array.isArray(a.user) ? a.user[0] : a.user;
            return (
              <Row key={a.user_id}>
                <div className="flex-1">
                  <div className="text-sm font-medium">{user?.display_name}</div>
                  <Meta>{a.tier} · {a.scope_type} · {a.status} · {timeAgo(a.created_at)}</Meta>
                </div>
                <Button size="sm" variant={a.status === "active" ? "destructive" : "outline"} onClick={() => setStatus.mutate({ data: { userId: a.user_id, status: a.status === "active" ? "suspended" : "active" } })}>
                  {a.status === "active" ? "Suspend" : "Reinstate"}
                </Button>
              </Row>
            );
          })}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}

// ---------- Campaigns ----------
function CampaignsPanel() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-campaigns", cursor], () => overseerListCampaigns({ data: { cursor } }));
  const setActive = useMutation({ mutationFn: useServerFn(overseerSetCampaignActive), onSuccess: () => qc.invalidateQueries({ queryKey: ["overseer-campaigns"] }) });
  return (
    <div>
      <div className="mb-2 flex justify-end"><Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button></div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="No campaigns." /> : (
        <ul>
          {(list.data ?? []).map((c) => (
            <Row key={c.id}>
              <div className="flex-1">
                <div className="text-sm font-medium">{c.name} <span className="ml-1 rounded bg-muted px-1 text-[10px] font-mono">{c.code}</span></div>
                <Meta>{c.landing_path} · {c.active ? "active" : "paused"} · {timeAgo(c.created_at)}</Meta>
              </div>
              <Button size="sm" variant={c.active ? "destructive" : "outline"} onClick={() => setActive.mutate({ data: { campaignId: c.id, active: !c.active } })}>
                {c.active ? "Pause" : "Resume"}
              </Button>
            </Row>
          ))}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}

// ---------- Redemptions ----------
function RedemptionsPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "paid" | "rejected" | "failed">("pending");
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-redemptions", status, cursor], () => overseerListRedemptions({ data: { status, cursor } }));
  const setStat = useMutation({ mutationFn: useServerFn(overseerSetRedemptionStatus), onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["overseer-redemptions"] }); } });
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <select className="h-8 rounded border bg-background px-2 text-xs" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setCursor(null); }}>
          {["pending", "approved", "paid", "rejected", "failed"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button>
      </div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="Nothing here." /> : (
        <ul>
          {(list.data ?? []).map((r) => {
            const user = Array.isArray(r.user) ? r.user[0] : r.user;
            return (
              <Row key={r.id}>
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.kind} · ₦{r.amount_naira.toLocaleString()} <Meta>({formatPoints(r.amount_points)} pts)</Meta></div>
                  <Meta>{user?.display_name} · {r.status} · {timeAgo(r.created_at)}</Meta>
                </div>
                <div className="flex flex-col gap-1">
                  {r.status === "pending" && <Button size="sm" onClick={() => setStat.mutate({ data: { redemptionId: r.id, status: "approved" } })}>Approve</Button>}
                  {(r.status === "pending" || r.status === "approved") && <Button size="sm" variant="outline" onClick={() => setStat.mutate({ data: { redemptionId: r.id, status: "paid" } })}>Mark paid</Button>}
                  {r.status !== "rejected" && r.status !== "paid" && <Button size="sm" variant="destructive" onClick={() => setStat.mutate({ data: { redemptionId: r.id, status: "rejected" } })}>Reject</Button>}
                </div>
              </Row>
            );
          })}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}

// ---------- Reports ----------
function ReportsPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed">("open");
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-reports", status, cursor], () => overseerListReports({ data: { status, cursor } }));
  const resolve = useMutation({ mutationFn: useServerFn(overseerResolveReport), onSuccess: () => { toast.success("Report closed"); qc.invalidateQueries({ queryKey: ["overseer-reports"] }); } });
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <select className="h-8 rounded border bg-background px-2 text-xs" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setCursor(null); }}>
          {["open", "resolved", "dismissed"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button>
      </div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="Nothing here." /> : (
        <ul>
          {(list.data ?? []).map((r) => {
            const reporter = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter;
            return (
              <Row key={r.id}>
                <div className="flex-1">
                  <div className="text-sm"><span className="font-medium">{r.target_kind}</span> · {r.reason}</div>
                  <Meta>by {reporter?.display_name ?? "—"} · {timeAgo(r.created_at)}</Meta>
                </div>
                {r.status === "open" && (
                  <div className="flex flex-col gap-1">
                    <Button size="sm" onClick={() => resolve.mutate({ data: { reportId: r.id, status: "resolved" } })}>Resolve</Button>
                    <Button size="sm" variant="outline" onClick={() => resolve.mutate({ data: { reportId: r.id, status: "dismissed" } })}>Dismiss</Button>
                  </div>
                )}
              </Row>
            );
          })}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}

// ---------- Ledger ----------
function LedgerPanel() {
  const [reason, setReason] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-ledger", reason, cursor], () => overseerListLedger({ data: { reason: reason || undefined, cursor } }));
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Input placeholder="Filter by reason (e.g. admin_adjust)" className="h-8 text-xs" value={reason} onChange={(e) => { setReason(e.target.value); setCursor(null); }} />
        <Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button>
      </div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="Empty." /> : (
        <ul>
          {(list.data ?? []).map((e) => (
            <Row key={e.id}>
              <div className="flex-1">
                <div className="text-sm">{e.delta > 0 ? "+" : ""}{e.delta} · {e.reason}</div>
                <Meta>{e.ref_type ?? "—"} · {timeAgo(e.created_at)}</Meta>
              </div>
            </Row>
          ))}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}

// ---------- Audit ----------
function AuditPanel() {
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useCursorQuery(["overseer-audit", cursor], () => overseerListAudit({ data: { cursor } }));
  return (
    <div>
      <div className="mb-2 flex justify-end"><Button size="sm" variant="outline" onClick={() => list.refetch()}>Refresh</Button></div>
      {list.isLoading ? <Empty label="Loading…" /> : (list.data ?? []).length === 0 ? <Empty label="No actions yet." /> : (
        <ul>
          {(list.data ?? []).map((a) => (
            <Row key={a.id}>
              <div className="flex-1">
                <div className="text-sm font-medium">{a.action}</div>
                <Meta>{a.target_kind ?? "—"}:{a.target_id?.slice(0, 8) ?? "—"} · {timeAgo(a.created_at)}</Meta>
              </div>
            </Row>
          ))}
        </ul>
      )}
      {(list.data?.length ?? 0) >= 10 && (
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCursor(list.data![list.data!.length - 1].created_at)}>Load older</Button>
      )}
    </div>
  );
}
