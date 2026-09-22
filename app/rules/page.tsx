import { readLeague } from "@/lib/store";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "League Rules" };

export default async function RulesPage() {
  const league = await readLeague();
  const rules = league.settings.rules
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);

  return (
    <div className="wrap">
      <PageTitle
        overline={league.settings.season}
        title="League Rules"
        lede={league.settings.description}
      />
      <div className="py-6 md:py-8 max-w-3xl">
        {rules.length === 0 ? (
          <p className="text-muted text-sm">
            No rules posted yet. Add them from Commissioner → League Settings.
          </p>
        ) : (
          <ol className="panel divide-y divide-line">
            {rules.map((rule, i) => (
              <li key={i} className="flex gap-3 px-4 py-3.5">
                <span className="display num text-muted-2 text-[1.1rem] leading-6 w-6 flex-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[0.93rem] leading-relaxed">{rule}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
