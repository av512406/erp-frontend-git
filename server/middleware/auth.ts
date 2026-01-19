import { Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import { pool } from "../db";

const JWT_SECRET = process.env.SESSION_SECRET || "super_secret_school_erp_key";

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
            session?: any;
        }
    }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        // Fallback for direct downloads (e.g. export)
        token = req.query.token as string;
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 3600 });
        req.user = decoded; // Attach decoded user to request
        // Also attach to session for backward compatibility if needed, but better to migrate
        req.session = { user: decoded };
        next();
    } catch (e: any) {
        console.error('JWT Verification Failed:', e.message); // Debugging 401
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

export const requireFeature = (featureName: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) return res.status(401).json({ message: 'Not authenticated' });

            if (user.role === 'superadmin') return next(); // Superadmin bypass

            const schoolId = user.schoolId;
            if (!schoolId) return res.status(403).json({ message: 'Feature restricted: No school context' });

            const schoolRes = await pool.query('SELECT features FROM schools WHERE id = $1', [schoolId]);
            if (schoolRes.rows.length === 0) return res.status(404).json({ message: 'School not found' });

            let features = schoolRes.rows[0].features;
            // Handle text or jsonb
            if (typeof features === 'string') {
                try { features = JSON.parse(features); } catch { features = {}; }
            } else if (!features) {
                features = {};
            }

            if (features[featureName]) {
                next();
            } else {
                res.status(403).json({ message: `Feature '${featureName}' is not enabled for your plan.` });
            }
        } catch (e) {
            console.error('Feature Check Failed:', e);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };
};

// Helper middleware from backup_routes
export const requireSchoolAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.schoolId) {
        return res.status(401).json({ message: "Not authenticated or no school associated" });
    }
    next();
};
