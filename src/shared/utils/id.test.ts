import { generateId } from './id';

describe('generateId', () => {
  it('should generate a unique ID string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should generate IDs with timestamp prefix', () => {
    const before = Date.now();
    const id = generateId();
    const after = Date.now();

    const timestamp = parseInt(id.split('-')[0], 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('should generate unique IDs on consecutive calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('should contain a hyphen separator', () => {
    const id = generateId();
    expect(id).toContain('-');
  });

  it('should have alphanumeric random suffix', () => {
    const id = generateId();
    const suffix = id.split('-')[1];
    expect(suffix).toMatch(/^[a-z0-9]+$/);
  });
});
