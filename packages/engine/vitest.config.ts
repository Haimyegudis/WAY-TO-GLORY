import { defineConfig } from 'vitest/config';

/**
 * Most of this suite is not unit tests: it walks whole careers, twenty seasons at a
 * time, across several seeds, because that is the only way to find out whether a career
 * holds together. A handful of those walks run for longer than the default five seconds
 * on an ordinary machine, and a slow laptop should report a failure, not a timeout.
 */
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
