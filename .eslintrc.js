module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: ['./tsconfig.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "prettier"
  ],
  plugins: ["@typescript-eslint"],
  rules: {
    // Add custom rules here
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "error", // Enforce strict typing as per code standards
    "@typescript-eslint/consistent-type-imports": "warn",
    "@typescript-eslint/array-type": ["error", { "default": "array-simple" }],
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error"
  },
  overrides: [
    {
      files: ["*.js"],
      rules: {
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
      },
    },
    {
      files: ["apps/frontend/**/*.ts", "apps/frontend/**/*.tsx"],
      extends: ["next/core-web-vitals"],
      rules: {
        "react/jsx-key": "error",
      }
    },
    {
      files: ["apps/backend/**/*.ts"],
      extends: ["plugin:@typescript-eslint/disable-type-checked"],
      rules: {
        // NestJS specific rules or overrides
      }
    }
  ],
  ignorePatterns: [
    "node_modules/",
    "dist/",
    ".next/",
    "build/",
    "*.mjs"
  ],
};
