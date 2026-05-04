import { describe, it, expect } from '@jest/globals';
import ResponseFormatter from '../../src/shared/utils/responseFormatter.js';

describe('ResponseFormatter', () => {
  it('should format success response correctly', () => {
    const data = { id: 1 };
    const result = ResponseFormatter.success(data, 'Success');
    expect(result.success).toBe(true);
    expect(result.message).toBe('Success');
    expect(result.data).toEqual(data);
  });

  it('should format error response correctly', () => {
    const result = ResponseFormatter.error('Not found', 404);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Not found');
    expect(result.errors).toBeDefined();
  });
});
