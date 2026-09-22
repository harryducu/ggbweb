import Link from "next/link";
import { isCommissioner } from "@/lib/auth";
import { readLeague } from "@/lib/store";
import { storageIsEphemeral } from "@/lib/storage";
import { signOutAction } from "@/lib/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { CommissionerLogin } from "@/components/admin/login";

export const metadata = { title: "Commissioner" };

export default async function CommissionerLayout({ children }: { children: React.ReactNode }) {
  const league = await readLeague();

  // One gate for every /commissioner route. Server actions re-check the session
  // independently, so a stale page can't be used to write data.
  if (!(await isCommissioner())) {
    return <CommissionerLogin logo={league.settings.logo} leagueName={league.settings.name} />;
  }

  return (
    <div className="wrap">
      <header className="pt-7 pb-4 border-b border-line flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="overline text-red">Admin · {league.settings.season}</div>
          <h1 className="display text-[clamp(1.8rem,6vw,2.8rem)] mt-1">Commissioner</h1>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Link href="/" className="btn btn-ghost btn-sm">
            View site
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="btn btn-sm">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {storageIsEphemeral() ? (
        <div role="alert" className="mt-4 panel border-loss/50 bg-loss/[0.08] px-4 py-3">
          <div className="overline text-loss">Saving is disabled on this deployment</div>
          <p className="hint mt-1.5 max-w-3xl !text-[0.85rem]">
            This site is running on Vercel with no writable storage, so every change here will fail.
            Vercel gives each request a read-only filesystem, and anything written would be
            discarded on the next deploy anyway.
          </p>
          <p className="hint mt-2 max-w-3xl !text-[0.85rem]">
            To fix it: in the Vercel dashboard open <strong>Storage</strong>, create a{" "}
            <strong>Blob</strong> store, connect it to this project, then redeploy. That adds a{" "}
            <code className="text-muted">BLOB_READ_WRITE_TOKEN</code> environment variable, which is
            all this app needs — it switches to Blob storage automatically and this banner
            disappears.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)] gap-0 lg:gap-8">
        <div className="lg:py-6">
          <AdminNav />
        </div>
        <div className="py-6 min-w-0">{children}</div>
      </div>
    </div>
  );
}
