// General types for the backend package

// Re-export task API adapter types for convenience
export * from '../tasks/types.js';

// Add any additional general types here
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}