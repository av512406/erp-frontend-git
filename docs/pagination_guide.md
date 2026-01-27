# Pagination Implementation Guide

## Overview
This document provides guidance on implementing pagination across the ERP system. The students endpoint already has pagination implemented (lines 79-125 in `server/routes/students.ts`), which serves as a reference implementation.

## Current Pagination Status

### ✅ Already Implemented
- **Students Endpoint** (`GET /api/students`): Full offset-based pagination with total count
  - Query params: `page`, `limit`
  - Returns: `{ data: [], meta: { total, page, limit } }`
  
### 📋 To Be Implemented
The following endpoints should follow the same pattern:

1. **Fees Endpoint** (`GET /api/fees`)
   - Add pagination support for fee transactions
   - Useful for schools with many transactions
   
2. **Grades Endpoint** (`GET /api/grades`)
   - Paginate grade entries
   - Filter by session, student, or term

3. **Attendance Endpoint** (`GET /api/attendance`)
   - Paginate attendance records
   - Filter by date range and session

4. **Staff Endpoint** (`GET /api/staff`)
   - Paginate staff listings
   - Less critical due to smaller datasets

## Implementation Pattern

### 1. Query Parameters
All paginated endpoints should accept:
```typescript
{
  page?: number,      // Page number (1-indexed), default: 1
  limit?: number,     // Items per page, default: 30, max: 100
  sessionId?: string, // Filter by session
  // ... other filters
}
```

### 2. Response Format
Use the standardized response format from `server/lib/response.ts`:

```typescript
import { paginatedResponse, getPaginationMeta } from '../lib/response';

// Count total
const countResult = await pool.query('SELECT COUNT(*) ...', params);
const total = parseInt(countResult.rows[0].total);

// Fetch data
const offset = (page - 1) * limit;
const dataResult = await pool.query('SELECT ... LIMIT $1 OFFSET $2', [...params, limit, offset]);

// Return standardized response
return res.json(paginatedResponse(
  dataResult.rows,
  getPaginationMeta(total, page, limit)
));
```

### 3. Validation
Use the validation middleware for query parameters:

```typescript
import { validateQuery, commonSchemas } from '../middleware/validation';

router.get('/api/fees',
  requireAuth,
  validateQuery(commonSchemas.pagination.merge(commonSchemas.sessionFilter)),
  async (req, res) => {
    // req.query is now typed and validated
  }
);
```

## Alternative: Cursor-Based Pagination

For real-time data or very large datasets, consider cursor-based pagination:

```typescript
// Query params
{
  cursor?: string,  // Last item ID from previous page
  limit?: number    // Items per page
}

// Response
{
  data: [...],
  meta: {
    hasMore: boolean,
    nextCursor: string | null,
    limit: number
  }
}
```

**Benefits:**
- More efficient for large datasets
- Handles real-time insertions better
- No offset performance issues

**Implementation:**
```typescript
import { getCursorMeta } from '../lib/response';

const limit = parseInt(req.query.limit as string) || 30;
const cursor = req.query.cursor as string;

// Fetch limit + 1 to check if more exist
const query = cursor
  ? 'SELECT * FROM table WHERE id > $1 ORDER BY id LIMIT $2'
  : 'SELECT * FROM table ORDER BY id LIMIT $1';

const params = cursor ? [cursor, limit + 1] : [limit + 1];
const result = await pool.query(query, params);

const meta = getCursorMeta(result.rows, limit);
const data = result.rows.slice(0, limit);

return res.json(paginatedResponse(data, meta));
```

## Migration Strategy

### Phase 1 (Immediate)
- Keep students pagination as-is (already optimal)
- No breaking changes needed

### Phase 2 (Next Sprint)
- Add pagination to fees endpoint (highest impact)
- Add pagination to grades endpoint
- Update frontend to handle pagination

### Phase 3 (Future)
- Consider cursor-based for endpoints with frequent updates
- Add infinite scroll support in frontend
- Optimize with database indexes (already completed in migration 0004)

## Frontend Integration

The frontend already handles paginated responses in `client/src/hooks/use-queries.ts`:

```typescript
// Handles both formats
if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
  return data.data;
}
return Array.isArray(data) ? data : [];
```

To fully utilize pagination:
1. Add page/limit state management
2. Display pagination controls
3. Show total count and page info
4. Implement "load more" or page numbers

## Performance Considerations

### With Indexes (✅ Completed)
Migration `0004_add_performance_indexes.sql` already added necessary indexes:
- `idx_fees_school_session_date` - Fees by school, session, date
- `idx_grades_school_session` - Grades by school and session
- `idx_attendance_school_date` - Attendance by school and date

These indexes support efficient OFFSET/LIMIT queries.

### Query Optimization
- Always use `WHERE` clauses before pagination
- Add `ORDER BY` for consistent results
- Use covering indexes when possible
- Consider materialized views for complex aggregations

## Testing Checklist

When implementing pagination on an endpoint:
- [ ] Verify correct total count
- [ ] Test first page (page=1)
- [ ] Test last page
- [ ] Test empty results
- [ ] Test invalid page numbers
- [ ] Verify performance with large datasets
- [ ] Check frontend integration
- [ ] Document new query parameters

## Complete Example

See `server/routes/students.ts` lines 79-125 for a complete, production-ready pagination implementation.

## Summary

**Status:** Framework ready, partial implementation
- ✅ Utilities created (`server/lib/response.ts`)
- ✅ Validation ready (`server/middleware/validation.ts`)
- ✅ Database indexes added (migration 0004)
- ✅ Reference implementation (students endpoint)
- 📋 Remaining: Apply to fees, grades, attendance endpoints

**Effort:** ~2-3 hours per endpoint
**Priority:** Medium (implement as datasets grow)
