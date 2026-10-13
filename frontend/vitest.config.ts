import path from "node:path";
import { defineConfig } from "vitest/config";

// Node 25 enables its own localStorage global, which hides jsdom's in the component tests. Older versions
// either have it off already or don't know the flag.
const disableNodeWebStorage = "--no-experimental-webstorage";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    execArgv: process.allowedNodeEnvironmentFlags.has(disableNodeWebStorage) ? [disableNodeWebStorage] : [],
  },
});
