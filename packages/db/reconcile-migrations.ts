// One-off: a dev DB that applied this branch's migrations under their old numbers.
// The merge renumbered them after main's, so drizzle would re-run them. Applies the
// migrations that main added and re-stamps the branch's six rows to their new
// timestamps, which is all drizzle compares. Matching is by position, not by file
// hash: a dev DB carries whichever version of a migration file it happened to apply.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const MAIN_TAGS = [
  '0106_unusual_deathstrike',
  '0107_lazy_cassandra_nova',
  '0108_omniscient_trish_tilby',
  '0109_curious_doctor_faustus',
  '0110_spooky_the_santerians',
];
// The branch's six, with the timestamps they carried before the merge.
const BRANCH = [
  { tag: '0111_wonderful_power_man', was: 1787649322244 },
  { tag: '0112_productive_marten_broadcloak', was: 1787674359372 },
  { tag: '0113_project_members_join_team', was: 1787687534229 },
  { tag: '0114_team_invites', was: 1787689061356 },
  { tag: '0115_team_notification_providers', was: 1787738728818 },
  { tag: '0116_team_integration_credentials', was: 1787761884656 },
];

const [url, folder, mode] = process.argv.slice(2);
const dry = mode !== 'apply';
const sql = postgres(url, { max: 1 });
const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, 'utf8'));
const whenOf = (tag: string): number => {
  const entry = journal.entries.find((e: { tag: string }) => e.tag === tag);
  if (!entry) throw new Error(`${tag} is not in the journal — wrong migrations folder?`);
  return entry.when;
};

const rows = await sql`select created_at from drizzle.__drizzle_migrations order by created_at`;
const tail = rows.slice(-BRANCH.length).map((r) => Number(r.created_at));
if (BRANCH.every((b, i) => whenOf(b.tag) === tail[i])) {
  console.log('Already reconciled — nothing to do.');
  await sql.end();
  process.exit(0);
}
if (BRANCH.some((b, i) => b.was !== tail[i])) {
  throw new Error(
    `This database does not end with the branch's six migrations (got ${tail.join(', ')}). ` +
      'Nothing was changed.',
  );
}

for (const tag of MAIN_TAGS) {
  const text = readFileSync(`${folder}/${tag}.sql`, 'utf8');
  const hash = createHash('sha256').update(text).digest('hex');
  const [seen] = await sql`select 1 from drizzle.__drizzle_migrations where hash = ${hash}`;
  if (seen) {
    console.log(`SKIP    ${tag} (already applied)`);
    continue;
  }
  console.log(`APPLY   ${tag}`);
  if (dry) continue;
  await sql.begin(async (tx) => {
    for (const stmt of text.split('--> statement-breakpoint')) {
      if (stmt.trim()) await tx.unsafe(stmt);
    }
    await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${whenOf(tag)})`;
  });
}

for (const { tag, was } of BRANCH) {
  const when = whenOf(tag);
  console.log(`RESTAMP ${tag}: ${was} -> ${when}`);
  if (!dry) {
    await sql`update drizzle.__drizzle_migrations set created_at = ${when} where created_at = ${was}`;
  }
}

console.log(dry ? '(dry run — nothing changed)' : 'done');
await sql.end();
