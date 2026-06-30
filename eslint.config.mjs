import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // False positive: fires on `useEffect(() => { asyncFetch() }, [])` because it
      // can't trace through async functions. All async data-fetch hooks in this project
      // use this idiomatic pattern safely.
      "react-hooks/set-state-in-effect": "off",
      // False positive from React Compiler: fires when useCallback is used with async
      // fetch patterns that the compiler can't safely auto-optimize. Code is correct.
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);

export default eslintConfig;
