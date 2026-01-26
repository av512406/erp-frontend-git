import { Router } from 'express';
import { pool, genId } from '../db';
import { requireAuth } from '../middleware/auth';
import { insertStaffSchema } from '@shared/schema';

const router = Router();

// Get all staff for a school
router.get('/api/staff', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const { rows } = await pool.query(`
      SELECT * FROM staff 
      WHERE school_id = $1
      ORDER BY name ASC
    `, [user.schoolId]);

        const mapped = rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone,
            position: r.position,
            monthlySalary: parseFloat(r.monthly_salary),
            joiningDate: r.joining_date ? new Date(r.joining_date).toISOString().split('T')[0] : null,
            status: r.status,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));

        res.json(mapped);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to fetch staff' });
    }
});

// Add new staff
router.post('/api/staff', requireAuth, async (req, res) => {
    const user = (req as any).user;
    try {
        const data = insertStaffSchema.parse(req.body);
        const id = genId();

        const { rows } = await pool.query(`
      INSERT INTO staff (id, name, email, phone, position, monthly_salary, joining_date, status, school_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
            id,
            data.name,
            data.email || null,
            data.phone || null,
            data.position,
            data.monthlySalary,
            data.joiningDate || null,
            data.status || 'active',
            user.schoolId
        ]);

        res.status(201).json({
            id: rows[0].id,
            name: rows[0].name,
            email: rows[0].email,
            phone: rows[0].phone,
            position: rows[0].position,
            monthlySalary: parseFloat(rows[0].monthly_salary),
            joiningDate: rows[0].joining_date ? new Date(rows[0].joining_date).toISOString().split('T')[0] : null,
            status: rows[0].status,
            createdAt: rows[0].created_at,
            updatedAt: rows[0].updated_at
        });
    } catch (e: any) {
        if (e.name === 'ZodError') {
            return res.status(400).json({ message: 'Validation error', issues: e.format() });
        }
        console.error(e);
        res.status(500).json({ message: 'Failed to add staff' });
    }
});

// Update staff
router.put('/api/staff/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    try {
        const data = insertStaffSchema.parse(req.body);

        const { rows } = await pool.query(`
      UPDATE staff 
      SET name = $1, email = $2, phone = $3, position = $4, 
          monthly_salary = $5, joining_date = $6, status = $7, updated_at = NOW()
      WHERE id = $8 AND school_id = $9
      RETURNING *
    `, [
            data.name,
            data.email || null,
            data.phone || null,
            data.position,
            data.monthlySalary,
            data.joiningDate || null,
            data.status || 'active',
            id,
            user.schoolId
        ]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        res.json({
            id: rows[0].id,
            name: rows[0].name,
            email: rows[0].email,
            phone: rows[0].phone,
            position: rows[0].position,
            monthlySalary: parseFloat(rows[0].monthly_salary),
            joiningDate: rows[0].joining_date ? new Date(rows[0].joining_date).toISOString().split('T')[0] : null,
            status: rows[0].status,
            createdAt: rows[0].created_at,
            updatedAt: rows[0].updated_at
        });
    } catch (e: any) {
        if (e.name === 'ZodError') {
            return res.status(400).json({ message: 'Validation error', issues: e.format() });
        }
        console.error(e);
        res.status(500).json({ message: 'Failed to update staff' });
    }
});

// Delete (soft delete) staff
router.delete('/api/staff/:id', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    try {
        // Soft delete by setting status to 'inactive'
        const { rows } = await pool.query(`
      UPDATE staff 
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1 AND school_id = $2
      RETURNING id
    `, [id, user.schoolId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        res.json({ message: 'Staff deactivated', id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to delete staff' });
    }
});

export const staffRouter = router;
