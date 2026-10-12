// @vitest-environment node
// Real PostgreSQL (PGlite), with a minimal Auth/Storage schema adapter.
// GoTrue, Storage HTTP enforcement, Realtime and pg_cron still need full Supabase verification.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
let db: PGlite;
const ids = {
  host: "00000000-0000-0000-0000-000000000001",
  melan: "00000000-0000-0000-0000-000000000002",
  shashi: "00000000-0000-0000-0000-000000000003",
};
const tid = (n: number) =>
  `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
async function admin() {
  await db.exec("reset role");
}
async function as(role: keyof typeof ids) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[role],
  ]);
  await db.exec("set role authenticated");
}
async function rows(sql: string, params: unknown[] = []) {
  return (await db.query<Record<string, unknown>>(sql, params)).rows;
}
async function saveTest(n: number, subject = "ET") {
  return db.query("select public.save_test($1,$2,90,100,'note',current_date)", [
    tid(n),
    subject,
  ]);
}
async function seedProof(n: number, role: keyof typeof ids = "melan") {
  await db.query(
    "insert into storage.objects(bucket_id,name) values('test-proofs',$1)",
    [`${ids[role]}/${tid(n)}/proof.jpg`],
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text unique,metadata jsonb default '{}');
 create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
 alter table storage.objects enable row level security; grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
 `);
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202610120001_study_space.sql",
      import.meta.url,
    ),
    "utf8",
  ).replace(/alter publication supabase_realtime add table[^;]+;/g, "");
  try {
    await db.exec(migration);
  } catch (e) {
    const detail = e as {
      message: string;
      position?: number;
      internalQuery?: string;
      where?: string;
    };
    throw new Error(
      JSON.stringify({
        ...detail,
        query: undefined,
        sourceNearPosition: migration.slice(
          Math.max(0, Number(detail.position) - 200),
          Number(detail.position) + 300,
        ),
      }),
    );
  }
}, 60000);
beforeEach(async () => {
  await admin();
  await db.exec(
    "truncate auth.users cascade; truncate public.challenges cascade; truncate public.audit_log; truncate storage.objects; update public.settings set exam_date=null,task_weight=70,test_weight=30,target_score=85,minimum_days=20,minimum_on_time=80;",
  );
  for (const role of ["host", "melan", "shashi"] as const) {
    await db.query("insert into auth.users(id) values($1)", [ids[role]]);
    await db.query(
      "insert into public.profiles(id,role,display_name) values($1,$2,$2)",
      [ids[role], role],
    );
  }
});
afterAll(async () => {
  await db?.close();
});
describe("database security and lifecycle", () => {
  it("rejects cross-owner RPC writes, direct writes, role forgery and student approvals", async () => {
    await as("melan");
    await expect(
      db.query("select public.save_task($1,$2,'forged',current_date+1)", [
        tid(1),
        ids.shashi,
      ]),
    ).rejects.toThrow("Access denied");
    await expect(
      db.query(
        "insert into public.tasks(id,owner_id,title,original_due) values($1,$2,'forged',current_date)",
        [tid(2), ids.melan],
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      db.exec("update public.profiles set role='host'"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("select public.review_test($1,true)", [tid(3)]),
    ).rejects.toThrow("Host access required");
    await expect(db.exec("select private.maintain()")).rejects.toThrow(
      "permission denied",
    );
    await as("shashi");
    await expect(
      db.query("select public.save_task($1,$2,'forged',current_date+1)", [
        tid(1),
        ids.melan,
      ]),
    ).rejects.toThrow("Access denied");
    await as("host");
    await db.query(
      "select public.save_task($1,$2,'Host plan',current_date+1)",
      [tid(1), ids.melan],
    );
    expect((await rows("select * from public.tasks")).length).toBe(1);
  });
  it("requires provisioned membership even with a valid authenticated role", async () => {
    await admin();
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      tid(99),
    ]);
    await db.exec("set role authenticated");
    expect(await rows("select * from public.profiles")).toHaveLength(0);
    await expect(db.exec("select public.catch_up()")).rejects.toThrow(
      "Access denied",
    );
  });
  it("allocates per-subject numbers, preserves retry/rejection numbers, and hides pending records and proofs", async () => {
    await as("melan");
    await saveTest(1);
    await saveTest(2);
    await saveTest(3, "ICT");
    await saveTest(1);
    expect(
      (
        await rows(
          "select test_number from public.tests where subject_code='ET' order by test_number",
        )
      ).map((r) => r.test_number),
    ).toEqual([1, 2]);
    await expect(
      db.query("select public.submit_test($1)", [tid(1)]),
    ).rejects.toThrow("Upload at least one");
    await seedProof(1);
    await db.query("select public.submit_test($1)", [tid(1)]);
    await as("shashi");
    expect(await rows("select * from public.tests")).toHaveLength(0);
    expect(await rows("select * from public.evidence")).toHaveLength(0);
    expect(await rows("select * from storage.objects")).toHaveLength(0);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('test-proofs',$1)",
        [`${ids.melan}/${tid(1)}/fake.jpg`],
      ),
    ).rejects.toThrow("row-level security");
    await as("host");
    expect(await rows("select * from storage.objects")).toHaveLength(1);
    await db.query(
      "select public.review_test($1,false,'Please correct marks')",
      [tid(1)],
    );
    await as("melan");
    await saveTest(1);
    await db.query("select public.submit_test($1)", [tid(1)]);
    expect(
      (
        await rows("select test_number from public.tests where id=$1", [tid(1)])
      )[0].test_number,
    ).toBe(1);
    await as("host");
    await db.query("select public.review_test($1,true)", [tid(1)]);
    await as("shashi");
    expect(await rows("select * from public.tests")).toHaveLength(1);
    expect(await rows("select * from public.evidence")).toHaveLength(0);
    expect(await rows("select * from storage.objects")).toHaveLength(0);
  });
  it("enforces score constraints and assigned subjects server-side", async () => {
    await as("melan");
    await expect(saveTest(1, "BIO")).rejects.toThrow(
      "Select one of your subjects",
    );
    await expect(
      db.query("select public.save_test($1,'ET',101,100,'',current_date)", [
        tid(1),
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("select public.save_test($1,'ET',0,0,'',current_date)", [
        tid(1),
      ]),
    ).rejects.toThrow();
  });
  it("rolls three missed tasks forward once and keeps prior day snapshots false after late completion", async () => {
    await admin();
    await db.exec(
      "insert into public.challenges(started_at,rules) select now()-interval '5 days',to_jsonb(s)-'id'-'exam_date' from public.settings s;",
    );
    for (let n = 1; n <= 3; n++)
      await db.query(
        "insert into public.tasks(id,owner_id,title,original_due) values($1,$2,'Past task',private.today()-2)",
        [tid(n), ids.melan],
      );
    await as("melan");
    await db.exec("select public.catch_up(); select public.catch_up();");
    expect(await rows("select * from public.task_days")).toHaveLength(9);
    await db.query("select public.complete_task($1,true)", [tid(1)]);
    const days = await rows(
      "select study_date,completed from public.task_days where task_id=$1 order by study_date",
      [tid(1)],
    );
    expect(days.map((d) => d.completed)).toEqual([false, false, true]);
    const scores = (await rows("select public.challenge_scores() as result"))[0]
      .result as {
      students: { melan: { total_tasks: number; on_time_tasks: number } };
    };
    expect(scores.students.melan.total_tasks).toBe(3);
    expect(scores.students.melan.on_time_tasks).toBe(0);
    await db.query("select public.complete_task($1,false)", [tid(1)]);
    expect(
      (
        await rows(
          "select completed from public.task_days where task_id=$1 order by study_date",
          [tid(1)],
        )
      ).every((d) => !d.completed),
    ).toBe(true);
  });
  it("counts eight of ten completions and undo correctly without touching the partner", async () => {
    await admin();
    for (let n = 1; n <= 10; n++)
      await db.query(
        "insert into public.tasks(id,owner_id,title,original_due) values($1,$2,'Today task',private.today())",
        [tid(n), ids.melan],
      );
    await as("melan");
    for (let n = 1; n <= 8; n++)
      await db.query("select public.complete_task($1,true)", [tid(n)]);
    expect(
      await rows("select * from public.task_days where completed"),
    ).toHaveLength(8);
    expect(await rows("select * from public.task_days")).toHaveLength(10);
    await db.query("select public.complete_task($1,false)", [tid(8)]);
    expect(
      await rows("select * from public.task_days where completed"),
    ).toHaveLength(7);
  });
  it("pending marks score zero and challenges do not expire after thirty days", async () => {
    await admin();
    await db.exec(
      "insert into public.challenges(started_at,rules) select now()-interval '40 days',to_jsonb(s)-'id'-'exam_date' from public.settings s;",
    );
    await as("melan");
    await saveTest(1);
    await seedProof(1);
    await db.query("select public.submit_test($1)", [tid(1)]);
    const result = (await rows("select public.challenge_scores() as value"))[0]
      .value as {
      students: { melan: { test_score: number; subject_coverage: number } };
    };
    expect(result.students.melan.test_score).toBe(0);
    expect(result.students.melan.subject_coverage).toBe(0);
    expect(
      await rows("select * from public.challenges where ended_at is null"),
    ).toHaveLength(1);
    expect(await rows("select * from public.rewards")).toHaveLength(0);
  });
  it("unlocks exactly once, freezes archives, resets scores, and preserves all old work on repeated calls", async () => {
    await admin();
    await db.exec(
      "insert into public.challenges(started_at,rules) select now()-interval '25 days',to_jsonb(s)-'id'-'exam_date' from public.settings s;",
    );
    const challenge = (await rows("select id from public.challenges"))[0].id;
    for (const role of ["melan", "shashi"] as const) {
      await db.query(
        `insert into public.tasks(id,owner_id,title,original_due,completed_at,challenge_id) select gen_random_uuid(),$1,'Completed obligation',private.today()-n,((private.today()-n)::timestamp+interval '12 hours') at time zone 'Asia/Colombo',$2 from generate_series(1,20) n`,
        [ids[role], challenge],
      );
      await db.query(
        "insert into public.tests(id,owner_id,subject_code,test_number,obtained,maximum,taken_on,status,challenge_id) select gen_random_uuid(),$1,code,1,90,100,private.today()-1,'approved',$2 from public.subjects where student_role=$3",
        [ids[role], challenge, role],
      );
    }
    await as("host");
    await db.exec(
      "select public.catch_up(); select public.catch_up(); select public.catch_up();",
    );
    expect(await rows("select * from public.rewards")).toHaveLength(1);
    expect(await rows("select * from public.challenges")).toHaveLength(2);
    expect(
      await rows("select * from public.challenges where ended_at is null"),
    ).toHaveLength(1);
    expect(await rows("select * from public.tasks")).toHaveLength(40);
    expect(await rows("select * from public.tests")).toHaveLength(6);
    const result = (await rows("select public.challenge_scores() as value"))[0]
      .value as {
      students: { melan: { score: number }; shashi: { score: number } };
    };
    expect(result.students.melan.score).toBe(0);
    expect(result.students.shashi.score).toBe(0);
    const snapshot = (
      await rows("select snapshot from public.challenges where id=$1", [
        challenge,
      ])
    )[0].snapshot;
    await db.exec("select public.catch_up()");
    expect(
      (
        await rows("select snapshot from public.challenges where id=$1", [
          challenge,
        ])
      )[0].snapshot,
    ).toEqual(snapshot);
    const task = (await rows("select id from public.tasks limit 1"))[0].id;
    await expect(
      db.query("select public.complete_task($1,false)", [task]),
    ).rejects.toThrow("archived challenge");
  });
  it("host settings are audited and do not move active challenge goalposts", async () => {
    await as("host");
    await db.exec("select public.activate_challenge()");
    await db.exec("select public.update_settings(null,60,40,90,25,85)");
    expect(
      (await rows("select rules from public.challenges"))[0].rules,
    ).toMatchObject({ task_weight: 70, target_score: 85 });
    expect(
      (await rows("select target_score from public.settings"))[0].target_score,
    ).toBe("90");
    expect(
      await rows(
        "select * from public.audit_log where action='settings_changed'",
      ),
    ).toHaveLength(1);
  });
});
