# Pagination Helpers — Usage Guide (Issue #47)

Pagination helpers live in `@zk-payroll/core` and support both
**cursor-based** (recommended) and **offset-based** access patterns.

---

## Quick start

```ts
import {
  getPayrollHistoryPage,
  getAuditRecordsPage,
  paginateIterator,
} from "@zk-payroll/core";
```

---

## Cursor-based pagination (recommended for UI consumers)

Cursor-based pagination is stable across inserts and deletions.
Pass the `nextCursor` from one page into the next request.

```ts
// First page
const page1 = getPayrollHistoryPage(
  allRecords,
  { recipient: "GABC..." },
  { pageSize: 25 }
);

// Next page
const page2 = getPayrollHistoryPage(
  allRecords,
  { recipient: "GABC..." },
  { pageSize: 25, cursor: page1.meta.nextCursor }
);

if (!page2.meta.hasNextPage) {
  console.log("Last page reached");
}
```

---

## Offset-based pagination (simpler, for small datasets)

```ts
const page = getPayrollHistoryPage(
  allRecords,
  {},
  { page2, pageSize: 20 }
);

console.log(`Page ${page.meta.page} of ${Math.ceil(page.meta.total / page.meta.pageSize)}`);
```

---

## Filtering

Filters are applied before pagination, so `meta.total` always reflects
the filtered count.

### Payroll history filters

| Field           | Type     | Description                              |
|-----------------|----------|------------------------------------------|
| `recipient`     | `string` | Exact match on recipient address         |
| `minAmount`     | `bigint` | Minimum payment amount (stroops)         |
| `maxAmount`     | `bigint` | Maximum payment amount (stroops)         |
| `fromTimestamp` | `number` | Start of range (Unix seconds, inclusive) |
| `toTimestamp`   | `number` | End of range (Unix seconds, inclusive)   |

### Audit record filters

| Field           | Type     | Description                              |
|-----------------|----------|------------------------------------------|
| `action`        | `string` | Exact match on action type               |
| `actor`         | `string` | Exact match on actor address             |
| `fromTimestamp` | `number` | Start of range (Unix seconds, inclusive) |
| `toTimestamp`   | `number` | End of range (Unix seconds, inclusive)   |

---

## Async iterator (server-side streaming)

Use `paginateIterator` to process large datasets page by page without
loading everything into memory.

```ts
for await (const page of paginateIterator(allRecords, { pageSize: 50 })) {
  await processPage(page.data);

  if (!page.meta.hasNextPage) break;
}
```

---

## PaginationMeta reference

```ts
interface PaginationMeta {
  total: number;        // Total filtered records
  count: number;        // Records in this page
  pageSize: number;     // Requested page size
  page: number;         // Current page (1-indexed)
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor?: string;  // Pass to next request
  prevCursor?: string;  // Pass to go back
}
```

---

## Page size limits

| Constant          | Value |
|-------------------|-------|
| `DEFAULT_PAGE_SIZE` | 20  |
| `MIN_PAGE_SIZE`     | 1   |
| `MAX_PAGE_SIZE`     | 100 |

Requests outside this range are automatically clamped.
