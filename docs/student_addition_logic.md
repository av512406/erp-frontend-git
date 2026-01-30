# Student Addition Logic - Complete Flow

## Overview
This document explains the complete logic flow for adding a student to the system.

---

## Frontend → Backend Flow

### 1. User Fills Form (Frontend)
**Component:** `StudentFormModal.tsx`

**Form Fields:**
```typescript
{
  // Student Info
  admissionNumber: string,
  name: string,
  dateOfBirth: Date,
  admissionDate: Date,
  aadharNumber: string,
  mobileNumber: string,
  address: string,
  fatherName: string,
  motherName: string,
  
  // Academic Info
  grade: string,              // e.g., "1", "2", "LKG"
  section: string,            // e.g., "A", "B"
  
  // Session (Critical!)
  sessionId: string,          // Selected from dropdown OR from navbar context
  
  // Fee Info
  yearlyFeeAmount: number,
  transportFee: number,
  isRTE: boolean              // If true, fees are set to 0
}
```

**Session Selection Priority:**
1. **Explicitly selected in form** → Uses that session
2. **Not selected** → Uses current session from navbar/context (`currentSessionId`)
3. Lines 50, 75, 98 in StudentFormModal.tsx

---

## 2. Backend Processing (POST /api/students)

**File:** `server/routes/students.ts` (lines 237-285)

### Step-by-Step Logic:

#### A. Determine Session ID
```typescript
// Priority 1: Use sessionId from request body (user's selection)
let sessionId = req.body.sessionId;

// Priority 2: Fallback to school's current_session_id
if (!sessionId) {
    sessionId = await getSchoolCurrentSession(user.schoolId);
}

// Error if still no session
if (!sessionId) {
    return 400: "No academic session specified"
}
```

#### B. Validate Session Belongs to School
```typescript
// Security check: Prevent adding students to another school's session
const sessionCheck = await query(
    'SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2',
    [sessionId, user.schoolId]
);

if (sessionCheck.rows.length === 0) {
    return 400: "Invalid session or doesn't belong to your school"
}
```

#### C. Check Admission Number Uniqueness
```typescript
const exists = await query(
    'SELECT 1 FROM students WHERE admission_number = $1 AND school_id = $2',
    [admissionNumber, user.schoolId]
);

if (exists.rowCount > 0) {
    return 409: "Admission number already exists"
}
```

#### D. Transaction Start
```sql
BEGIN;
```

#### E. Insert into `students` Table
```sql
INSERT INTO students (
    id,                    -- Generated UUID
    admission_number,
    name,
    date_of_birth,
    admission_date,
    aadhar_number,
    pen_number,
    aapar_id,
    mobile_number,
    address,
    grade,                 -- Current grade
    section,               -- Current section
    father_name,
    mother_name,
    status,                -- 'active'
    school_id
) VALUES (...)
RETURNING *;
```

#### F. Calculate Fees for RTE Students
```typescript
const isRTE = data.isRTE === true || 
              String(data.isRTE).toLowerCase() === 'true' || 
              String(data.isRTE).toLowerCase() === 'yes';

// RTE waives ONLY tuition fees, not transport fees
const finalYearlyFee = isRTE ? 0 : (data.yearlyFeeAmount || 0);
const finalTransportFee = data.transportFee || 0; // All students pay transport
```

#### G. Insert into `student_sessions` Table
```sql
INSERT INTO student_sessions (
    id,                    -- Generated UUID
    student_id,           -- From step E
    session_id,           -- Determined in step A
    grade,
    section,
    status,               -- 'active'
    school_id,
    transport_fee,        -- From step F
    yearly_fee_amount,    -- From step F
    is_rte                -- Boolean flag
) VALUES (...)
```

#### H. Commit Transaction
```sql
COMMIT;
```

#### I. Return Success
```json
{
  "id": "uuid",
  "admissionNumber": "123",
  "name": "Student Name",
  ...
}
```

---

## 3. Database State After Addition

### `students` Table
```
| id   | admission_number | name | grade | section | school_id | status  |
|------|------------------|------|-------|---------|-----------|---------|
| uuid | 123              | John | 1     | A       | school1   | active  |
```

### `student_sessions` Table
```
| id   | student_id | session_id | grade | section | yearly_fee | transport_fee | is_rte | school_id |
|------|------------|------------|-------|---------|------------|---------------|--------|-----------|
| uuid | uuid       | session1   | 1     | A       | 5000       | 500           | false  | school1   |
```

**Note:** A student can have multiple records in `student_sessions` (one per academic year), but only one record in `students`.

---

## 4. Error Scenarios

### Error 400: No Session Specified
**Cause:**
- No `sessionId` in request body
- School has no `current_session_id` set
- User didn't select session in form

**Fix:**
- Select session in form dropdown
- OR set school's current session in Settings

### Error 400: Invalid Session
**Cause:**
- `sessionId` doesn't exist
- Session belongs to different school (security check)

**Fix:**
- Select valid session from dropdown
- Ensure session exists for your school

### Error 409: Admission Number Exists
**Cause:**
- Another student in same school already has this admission number

**Fix:**
- Use different admission number
- Check if student already exists

### Error 401: Unauthorized
**Cause:**
- JWT token expired (typically after 30-60 minutes)

**Fix:**
- Refresh page and login again

---

## 5. Important Business Rules

### Multi-Tenant Isolation
✅ **Every query includes `school_id`**
- Students can only be added to their own school
- Admission numbers are unique per school (School A and School B can both have student "001")

### Session Enrollment
✅ **Students are enrolled in specific sessions**
- Student record = permanent (in `students` table)
- Session enrollment = per year (in `student_sessions` table)
- Same student can be promoted to new sessions

### RTE Fee Waiver
✅ **RTE students get tuition fee waived, but still pay transport**
- If `isRTE = true`, yearly tuition fee is set to 0
- Transport fee is still charged at normal rate
- Override possible in `student_sessions` table per year

### Grade/Section Tracking
✅ **Stored in both tables**
- `students.grade` & `students.section` = current/latest
- `student_sessions.grade` & `student_sessions.section` = for that specific year
- Allows tracking of grade progression over years

---

## 6. Data Flow Diagram

```
┌─────────────────┐
│ User fills form │
│ Selects session │ 
└────────┬────────┘
         │
         ▼
┌────────────────────┐
│ POST /api/students │
│ { sessionId, ... } │
└────────┬───────────┘
         │
         ▼
┌─────────────────────────┐
│ Determine session:      │
│ 1. Use req.body session │
│ 2. Fallback to current  │
└────────┬────────────────┘
         │
         ▼
┌────────────────────────┐
│ Validate session       │
│ belongs to school      │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Check admission number │
│ uniqueness (per school)│
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ BEGIN TRANSACTION      │
└────────┬───────────────┘
         │
         ├──► INSERT INTO students
         │
         ├──► Calculate RTE fees
         │
         ├──► INSERT INTO student_sessions
         │
         ▼
┌────────────────────────┐
│ COMMIT                 │
│ Return student data    │
└────────────────────────┘
```

---

## 7. Testing Checklist

### Prerequisites
- [ ] At least one academic session exists for school
- [ ] Session is selected in navbar OR school has `current_session_id` set

### Happy Path
- [ ] Add student with all required fields → Success 201
- [ ] Student appears in students list
- [ ] Student is enrolled in selected session
- [ ] Fees are correctly set (RTE vs non-RTE)

### Error Cases
- [ ] Add student without selecting session → Clear error message
- [ ] Add student with duplicate admission number → 409 error
- [ ] Add student with invalid session ID → 400 error
- [ ] Add student after token expires → 401 error, prompts re-login

### Edge Cases
- [ ] Add RTE student → Fees should be 0
- [ ] Add student to different session than navbar → Uses form selection
- [ ] Add student without form selection → Uses navbar/current session

---

## 8. Related Files

**Backend:**
- `server/routes/students.ts` - Main student creation logic
- `shared/schema.ts` - Database schema & validation
- `server/middleware/auth.ts` - Authentication

**Frontend:**
- `client/src/components/StudentFormModal.tsx` - Add student form
- `client/src/App.tsx` - Student creation handler
- `client/src/components/StudentsPage.tsx` - Main students page

**Database:**
- `students` table - Core student data
- `student_sessions` table - Session enrollment & fees
- `academic_sessions` table - Session definitions
- `schools` table - School config including `current_session_id`

---

## 9. Future Improvements

**Nice to have:**
1. Auto-generate admission numbers
2. Bulk student import from Excel (already exists!)
3. Student photo upload
4. Parent portal account auto-creation
5. Email/SMS notification on student addition
6. Student ID card generation
7. Admission form PDF export

---

**Last Updated:** January 28, 2026  
**Status:** ✅ Logic fixed - now uses sessionId from form first, then falls back to current session
