import Link from "next/link";
import { isCommissioner } from "@/lib/auth";
import { readLeague } from "@/lib/store";
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

      <div className="grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)] gap-0 lg:gap-8">
        <div className="lg:py-6">
          <AdminNav />
        </div>
        <div className="py-6 min-w-0">{children}</div>
      </div>
    </div>
  );
}
