# StudyLab XP

## Release

The site reads balances from Supabase. Apply the XP migration after the Study Room credit journal and Plus foundation, then deploy the website changes. The migration seeds each registered profile with 100 XP and records its activation timestamp. Earlier timer credits and payment records are outside the XP launch window. Existing browser tasks import privately and keep their completion history.

The room credits 1 XP for every 360 confirmed seconds. A qualifying session target starts at 30 minutes, is set before the session, and pays +10 XP at most once per Asia/Colombo day. The first three new task completions each day pay 4 XP each. Tasks, award history, and receipts have no public data endpoints. The public views include exact integer strings and limit visible ranking rows.

The once per payment award is linked to the existing PayHere billing journal. The verified provider settlement must write a matching order and receipt in the live environment with state `confirmed`. A `refunded` state reverses a previous award in the same transaction. Report a refund only when the whole payment is refunded. The catalog is LKR 199, 499, and 1,799 for 1, 3, and 12 months. Keep the trusted checkout catalog and displayed reward aligned. The current checkout remains disabled until the independent PayHere settlement integration is activated and verified on the approved host. Complimentary memberships and sandbox activity do not earn purchase XP.

The existing GitHub checks run XP regression coverage in isolated Postgres and browser DOMs. The focused command is `node scripts/studylab-xp-tests.cjs` after `npm ci`.

## Interface

- Levels start at 100 XP and cap at Level 20 at 7,800 XP. Frame upgrades appear at Levels 5, 10, 15, and 20. The XP total can continue growing.
- The Study Room keeps the study time views. Total XP uses all awards and shows that it includes Plus bonuses. Study XP views use timer, qualifying goal, and task points for today or this week. The weekly boundary is Monday at midnight in Sri Lanka.
- The profile shows exact XP under the username. The live card opens a small glass bar with the exact amount and level when a student selects its compact chip.
