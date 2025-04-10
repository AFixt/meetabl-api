/**
 * Example test file
 *
 * Demonstrates basic test setup
 *
 * @author meetabl Team
 */

describe('Example Test Suite', () => {
  test('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should pass async test', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});
