export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[] | null;
  statusCode: number;
  timestamp: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

class ResponseFormatter {
  static success<T>(data: T | null = null, message = 'Success', statusCode = 200): ApiResponse<T> {
    return { success: true, message, data: data ?? undefined, statusCode, timestamp: new Date().toISOString() };
  }

  static error(message = 'Error', statusCode = 500, errors: string[] | null = null): ApiResponse {
    return { success: false, message, errors, statusCode, timestamp: new Date().toISOString() };
  }

  static paginated<T>(data: T, page: number, limit: number, total: number): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);
    return {
      success: true,
      message: 'Success',
      data,
      statusCode: 200,
      timestamp: new Date().toISOString(),
      pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    };
  }
}

export default ResponseFormatter;
