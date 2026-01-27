import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { fromZodError } from 'zod-validation-error';

/**
 * Input validation middleware using Zod schemas
 * Validates request body against provided schema and returns structured errors
 */
export const validateBody = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate and parse the request body
            req.body = schema.parse(req.body);
            next();
        } catch (err) {
            if (err instanceof z.ZodError) {
                // Convert Zod error to user-friendly format
                const validationError = fromZodError(err);
                return res.status(400).json({
                    error: 'Validation failed',
                    message: validationError.message,
                    details: err.errors
                });
            }
            // Pass other errors to error handler
            next(err);
        }
    };
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.query = schema.parse(req.query);
            next();
        } catch (err) {
            if (err instanceof z.ZodError) {
                const validationError = fromZodError(err);
                return res.status(400).json({
                    error: 'Invalid query parameters',
                    message: validationError.message,
                    details: err.errors
                });
            }
            next(err);
        }
    };
};

/**
 * Validate route parameters
 */
export const validateParams = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.params = schema.parse(req.params);
            next();
        } catch (err) {
            if (err instanceof z.ZodError) {
                const validationError = fromZodError(err);
                return res.status(400).json({
                    error: 'Invalid route parameters',
                    message: validationError.message,
                    details: err.errors
                });
            }
            next(err);
        }
    };
};

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
    // Pagination
    pagination: z.object({
        page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 30),
        cursor: z.string().optional(),
    }),

    // ID parameter
    id: z.object({
        id: z.string().uuid('Invalid ID format'),
    }),

    // Session filter
    sessionFilter: z.object({
        sessionId: z.string().uuid('Invalid session ID').optional(),
    }),

    // Date range
    dateRange: z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    }),
};
