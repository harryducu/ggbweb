import Link from "next/link";
import { readLeague } from "@/lib/store";

export const metadata = { title: "Page not found" };

export default async function NotFound() {
  const league = await readLeague();

  return (
    <div className="wrap py-20 md:py-28 text-center">
      <div className="overline text-red">Gutter ball</div>
      <h1 className="display text-[clamp(3rem,14vw,7rem)] mt-2">7–10 Split</h1>
      <p className="text-muted mt-3 max-w-md mx-auto">
        That page isn&apos;t here. It may have been renamed, or the bowler or team no longer exists
        in the league.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary">
          Back to the league
        </Link>
        <Link href="/standings" className="btn">
          Standings
        </Link>
        <Link href="/schedule" className="btn">
          Schedule
        </Link>
      </div>
      <p className="overline mt-10">{league.settings.name}</p>
    </div>
  );
}
