import { expect, test } from 'bun:test';
import { adrBadge, adrCounts } from './summarize.ts';

const md = `---
id: ADR-0001
title: A
status: accepted
revisit: 2026-12-01
---

## Goal
Body with a rule:

---

Still body.

---
title: B
---
---
title: C
status: Superseded
---
`;

test('counts statuses (missing/unknown = proposed) and revisits due within 30 days', () => {
  const c = adrCounts(md, '2026-11-18');
  expect(c).toMatchObject({ total: 3, accepted: 1, proposed: 1, superseded: 1, due: 1 });
  expect(adrCounts(md, '2026-10-01').due).toBe(0);
  expect(adrBadge(c)).toContain('A: 1 ✅');
});
