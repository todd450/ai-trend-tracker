import { NEW_TAB } from "@/lib/links";
import { fmtCompact, fmtDay } from "@/lib/trends";
import { buildWeek, type WeekEntry } from "@/lib/week";

/** The eight lists below the block, by their anchors, as the jump links name them. */
const LISTS = [
  ["news", "In the news"],
  ["papers", "Papers"],
  ["analysis", "From the analysts"],
  ["announcements", "Lab announcements"],
  ["launches", "Launches"],
  ["code", "Repositories"],
  ["models", "Models trending"],
  ["labs", "New from the labs"],
] as const;

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const count = (n: number) => (n === 1 ? "one more" : `${n} more`);

/** One item in a trend's group: its label when a rule or the editor lifted it, the headline, where it is from. */
function Item({ item }: { item: WeekEntry }) {
  return (
    <li className="tgroup__item">
      {item.pinned ? (
        <p className="top-story__kicker">Editor’s pick</p>
      ) : (
        item.launch && <p className="top-story__kicker">Lab launch</p>
      )}
      <h4>
        <a href={item.url} {...NEW_TAB}>{item.title}</a>
      </h4>
      <p className="tgroup__meta">
        {item.from}
        {item.discussion && (
          <>
            {" · "}
            <a href={item.discussion.url} {...NEW_TAB}>{fmtCompact(item.discussion.points)} points</a>
          </>
        )}
        {" · "}
        {fmtDay(item.publishedAt)}
        {item.also.length > 0 && (
          <span className="tgroup__same">
            Same story:{" "}
            {item.also.map((other, n) => (
              <span key={other.url}>
                {n > 0 && ", "}
                <a href={other.url} {...NEW_TAB}>{other.title}</a> ({other.from})
              </span>
            ))}
          </span>
        )}
      </p>
      {item.pinned?.note && (
        <p className="tgroup__note">
          <b>Editor’s note:</b> {item.pinned.note}
        </p>
      )}
    </li>
  );
}

/**
 * "This week": up to seven of the past seven days' items, chosen by the rules in `buildWeek` and
 * grouped under the trend each one feeds, then a row of links down to the eight lists. The line
 * under each trend is read from the tracker's own figures by a rule, so it says how the trend is
 * moving, not why a story matters. `lists` names the anchors of the lists the page shows today.
 */
export function ThisWeek({ lists }: { lists: readonly string[] }) {
  const week = buildWeek();
  const [biggest, ...others] = week.leftOut;
  return (
    <section id="week" className="band week" aria-labelledby="week-h">
      <div className="band__head week__head">
        <h2 id="week-h">This week</h2>
        <p>
          <strong>The past seven days, to {dayMonth.format(new Date(week.until))}.</strong> Chosen by rule from the
          lists below: stories that name a trend the site tracks, launches first.
        </p>
      </div>

      {week.groups.length > 0 ? (
        <div className="week__groups">
          {week.groups.map((group, g) => (
            <section className="tgroup" aria-labelledby={`week-g${g}`} key={group.tag?.href ?? group.items[0].url}>
              <h3 className="tgroup__head" id={`week-g${g}`}>
                {group.tag ? (
                  <a className="tag" href={group.tag.href}>
                    <span className="vh">Trend: </span>
                    {group.tag.name}
                  </a>
                ) : (
                  <span className="tgroup__none">No tracked trend</span>
                )}
                {group.call && <span className={`tgroup__call tgroup__call--${group.call.split(" ")[0]}`}>{group.call}</span>}
              </h3>
              {group.line && (
                <p className="tgroup__line">
                  <strong>The trend:</strong> {group.line}
                </p>
              )}
              <ol className="tgroup__items">
                {group.items.map((item) => (
                  <Item item={item} key={item.url} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <p className="band__empty">Nothing in the past seven days names a trend the site tracks. The lists below have the week’s items.</p>
      )}

      {biggest && (
        <p className="week__left">
          Left out because {others.length ? "they name" : "it names"} no tracked trend:{" "}
          {biggest.list && lists.includes(biggest.list) ? <a href={`#${biggest.list}`}>{biggest.title}</a> : biggest.title} (
          {fmtCompact(biggest.discussion?.points ?? 0)} points){others.length > 0 && <> and {count(others.length)}</>}.{" "}
          {others.length ? "They are" : "It is"} in the lists below.
        </p>
      )}

      <nav className="week__jump" aria-label="All the lists">
        <span>All the lists:</span>
        {LISTS.filter(([id]) => lists.includes(id)).map(([id, name]) => (
          <a href={`#${id}`} key={id}>
            {name}
          </a>
        ))}
      </nav>
    </section>
  );
}
