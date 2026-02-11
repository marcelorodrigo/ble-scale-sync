import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/utils/retry.js';
import type { Logger } from '../../src/logger.js';

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('withRetry', () => {
  it('returns success on first attempt', async () => {
    const log = createMockLogger();
    const fn = vi.fn().mockResolvedValue({ success: true });

    const result = await withRetry(fn, { log, label: 'test' });

    expect(result).toEqual({ success: true });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(log.info).not.toHaveBeenCalled();
  });

  it('retries on thrown error and succeeds', async () => {
    const log = createMockLogger();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ success: true });

    const result = await withRetry(fn, { log, label: 'upload' });

    expect(result).toEqual({ success: true });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith('Retrying upload (1/2)...');
  });

  it('retries on { success: false } result', async () => {
    const log = createMockLogger();
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'auth failed' })
      .mockResolvedValueOnce({ success: true });

    const result = await withRetry(fn, { log, label: 'upload' });

    expect(result).toEqual({ success: true });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledWith('upload failed: auth failed');
  });

  it('returns failure after all retries exhausted (thrown errors)', async () => {
    const log = createMockLogger();
    const fn = vi.fn().mockRejectedValue(new Error('timeout'));

    const result = await withRetry(fn, { log, label: 'webhook', maxRetries: 2 });

    expect(result).toEqual({ success: false, error: 'timeout' });
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(log.error).toHaveBeenCalledTimes(3);
    expect(log.info).toHaveBeenCalledTimes(2);
  });

  it('returns failure after all retries exhausted ({ success: false })', async () => {
    const log = createMockLogger();
    const fn = vi.fn().mockResolvedValue({ success: false, error: 'server error' });

    const result = await withRetry(fn, { log, label: 'influx' });

    expect(result).toEqual({ success: false, error: 'server error' });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects custom maxRetries', async () => {
    const log = createMockLogger();
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    const result = await withRetry(fn, { log, label: 'test', maxRetries: 0 });

    expect(result).toEqual({ success: false, error: 'fail' });
    expect(fn).toHaveBeenCalledTimes(1); // no retries
  });

  it('handles non-Error thrown values', async () => {
    const log = createMockLogger();
    const fn = vi.fn().mockRejectedValue('string error');

    const result = await withRetry(fn, { log, label: 'test', maxRetries: 0 });

    expect(result).toEqual({ success: false, error: 'string error' });
  });

  it('uses undefined as error when result has no error field', async () => {
    const log = createMockLogger();
    // Return { success: false } with no error field
    const fn = vi.fn().mockResolvedValue({ success: false });

    const result = await withRetry(fn, { log, label: 'mqtt', maxRetries: 0 });

    expect(result.success).toBe(false);
    // lastError is undefined (from result.error), so fallback message is used
    expect(result.error).toBe('All mqtt attempts failed');
  });

  it('logs retry attempts with correct numbering', async () => {
    const log = createMockLogger();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValueOnce({ success: true });

    await withRetry(fn, { log, label: 'op', maxRetries: 2 });

    expect(log.info).toHaveBeenCalledWith('Retrying op (1/2)...');
    expect(log.info).toHaveBeenCalledWith('Retrying op (2/2)...');
  });
});
