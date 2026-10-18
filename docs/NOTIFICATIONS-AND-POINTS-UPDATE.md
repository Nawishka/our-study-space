# Notifications and challenge points update

This updates the existing installation. Keep the current accounts, passwords, role mappings, Supabase settings, proofs and work. No email setup or new primary page is needed.

## One database step

You already applied `202610140004_scoring_v2.sql`. Apply **only** [202610170005_notifications_and_points.sql](../supabase/migrations/202610170005_notifications_and_points.sql) once:

1. Open that file and copy its complete contents.
2. In your existing Supabase project, open **SQL Editor → + → Create a new snippet**.
3. Paste the SQL and click **Run**. Wait for success. It runs in one transaction, so a failure rolls the update back.
4. Refresh the app, sign in as Host, and check **Notifications** and **Our Journey → Host · Add challenge points**.

Do not rerun migrations 001–004, recreate accounts, reset passwords, or change public connection variables. GitHub Pages deploys the frontend only; it cannot apply this database migration. Before the SQL is installed, ordinary study features remain available, the notification panel explains it cannot load, and manual points are disabled.

You can verify installation in SQL Editor with this read-only query:

```sql
select to_regclass('public.notifications') as notifications,
       to_regprocedure('public.add_manual_points(uuid,uuid,uuid,numeric,text)') as host_points;
select practice_weight, performance_weight, postponed_penalty_points
from public.settings where id = true;
```

The first row should have two non-null names. The second should show **25, 5, 1** unless Host subsequently changed the next-challenge weights.

## How points work

- A task missed at the end of its original Sri Lankan due date deducts **1 point once**. Carrying it forward again does not deduct another point. Completing it late does not erase that missed deadline. The total stays between 0 and 100.
- The deduction is additional to the existing on-time ratio. Existing active challenge weights stay unchanged. An audited rule amendment starts deductions only for original deadlines **on or after the installation day**. Earlier overdue work is exempt. Archived rules, score snapshots and rewards are not changed.
- New challenges default to **70 task + 25 practice + 5 performance points**, instead of 70/15/15. With the default target of two approved tests in each subject, each qualifying paper adds approximately **4.17 practice points**, up from 2.5, until that subject's practice cap. Each subject has equal weight. Pending/rejected papers earn no points. Extra papers still appear in history and affect subject averages; averages can go down.
- Host can adjust the practice target and weights for the next challenge. The exact rules are saved with each challenge. The two-paper target is not an eligibility gate. Qualification still requires 85 points, 20 active study days, 80% on-time completion, and an approved test in every subject by default.
- Host can add positive points to either student's active challenge, with a required reason. The adjustment records the Host, time, student, challenge and reason. It cannot edit an archived reward or bypass active days, on-time percentage or subject coverage. It can complete the score requirement; if both students meet every requirement the usual atomic reward/archive/reset runs.
- Failed or uncertain manual saves retain a request receipt. Retry the **same details** to avoid duplicate points. The server also rejects reuse of that receipt for different details. A new deliberate adjustment uses a new receipt.

## Notification privacy

Each student can read only their own notices. Host can see everyone or filter by student. All roles can filter unread notices, warnings, score changes, test decisions and postponed tasks. Read receipts are separate for each person; Host reading a notice does not mark it read for the student.

Red warnings cover missed tasks, score decreases and rejected tests. Score changes use full precision, even when rounded display values look the same. Review decisions retain the rejection reason and correction history. Nothing backfills a misleading history of old score changes. Catch-up and Cron share the same lock and unique event keys, preventing repeated carryover, refresh or Realtime events from duplicating notices. Other-device events do not play unsolicited sounds.

## Verification boundaries

Embedded PostgreSQL tests use the actual migrations with minimal Auth/Storage adapters. They check preservation, penalties, Host-only adjustments, receipts, notification RLS, correction events, archive snapshots and reset. React tests cover filter privacy and failed/retried saves. Responsive browser tests use clearly labelled sample data at 375, 768 and 1440 pixels. CI additionally runs full local Supabase and pgTAP in Docker.

These checks do not prove hosted password sign-in, live Storage, Realtime delivery, or scheduled execution. After the SQL succeeds, sign in privately with the existing accounts and verify one real task, one approval/rejection, and an intentional Host adjustment. Do not create synthetic rewards or reset production history to test the new feature.
