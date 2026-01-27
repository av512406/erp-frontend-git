/**
 * Standard API Response Utilities
 * Provides consistent response format across all endpoints
 */

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        hasMore?: boolean;
        nextCursor?: string | null;
    };
}

/**
 * Send success response with data
 */
export function successResponse<T>(data: T, meta?: ApiResponse['meta']): ApiResponse<T> {
    return {
        success: true,
        data,
        ...(meta && { meta }),
    };
}

/**
 * Send success response with message only
 */
export function successMessage(message: string): ApiResponse {
    return {
        success: true,
        message,
    };
}

/**
 * Send error response
 */
export function errorResponse(error: string, message?: string): ApiResponse {
    return {
        success: false,
        error,
        ...(message && { message }),
    };
}

/**
 * Send paginated response
 */
export function paginatedResponse<T>(
    data: T[],
    meta: {
        total?: number;
        page: number;
        limit: number;
        hasMore?: boolean;
        nextCursor?: string | null;
    }
): ApiResponse<T[]> {
    return {
        success: true,
        data,
        meta,
    };
}

/**
 * Standard error classes
 */
export class ApiError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(404, message);
        this.name = 'NotFoundError';
    }
}

export class ValidationError extends ApiError {
    constructor(message = 'Validation failed', details?: any) {
        super(400, message, details);
        this.name = 'ValidationError';
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message = 'Authentication required') {
        super(401, message);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = 'Access forbidden') {
        super(403, message);
        this.name = 'ForbiddenError';
    }
}

export class ConflictError extends ApiError {
    constructor(message = 'Resource conflict') {
        super(409, message);
        this.name = 'ConflictError';
    }
}

/**
 * Helper to calculate pagination metadata
 */
export function getPaginationMeta(
    total: number,
    page: number,
    limit: number
): ApiResponse['meta'] {
    const totalPages = Math.ceil(total / limit);
    return {
        total,
        page,
        limit,
        hasMore: page < totalPages,
    };
}

/**
 * Helper for cursor-based pagination
 */
export function getCursorMeta<T extends { id: string }>(
    items: T[],
    limit: number
): ApiResponse['meta'] {
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
        hasMore,
        nextCursor,
        limit,
    };
}
