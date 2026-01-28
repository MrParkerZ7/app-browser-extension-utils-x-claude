import { wait, getRandomDelay } from './timing';

describe('wait', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return a promise', () => {
    const result = wait(100);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should resolve after specified milliseconds', async () => {
    const promise = wait(1000);

    jest.advanceTimersByTime(999);
    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(1);
    await promise;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should resolve immediately with 0ms', async () => {
    const promise = wait(0);
    jest.advanceTimersByTime(0);
    await promise;
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('getRandomDelay', () => {
  it('should return a number', () => {
    const result = getRandomDelay(100, 200);
    expect(typeof result).toBe('number');
  });

  it('should return value within range (inclusive)', () => {
    for (let i = 0; i < 100; i++) {
      const result = getRandomDelay(100, 200);
      expect(result).toBeGreaterThanOrEqual(100);
      expect(result).toBeLessThanOrEqual(200);
    }
  });

  it('should return exact value when min equals max', () => {
    const result = getRandomDelay(150, 150);
    expect(result).toBe(150);
  });

  it('should return integer values', () => {
    for (let i = 0; i < 50; i++) {
      const result = getRandomDelay(100, 200);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('should work with zero as minimum', () => {
    for (let i = 0; i < 50; i++) {
      const result = getRandomDelay(0, 100);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    }
  });

  it('should produce varied results', () => {
    const results = new Set<number>();
    for (let i = 0; i < 100; i++) {
      results.add(getRandomDelay(0, 1000));
    }
    // With a range of 1000, we should get more than 1 unique value
    expect(results.size).toBeGreaterThan(1);
  });
});
