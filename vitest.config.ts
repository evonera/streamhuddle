import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    testTimeout: 20_000,
    include: ["tests/**/*.test.{ts,tsx}"],
    // `.claude/worktrees` holds full checkouts of other branches; without this
    // their copies of the suite run too, doubling load and causing timeouts.
    exclude: [...configDefaults.exclude, ".claude/**", "dist/**", ".output/**"],
  },
})
