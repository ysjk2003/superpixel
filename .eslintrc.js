module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: ["eslint:recommended", "prettier", "plugin:@typescript-eslint/eslint-recommended"],
  parser: "@typescript-eslint/parser",
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
  plugins: ["import", "prettier"],
  rules: {
    camelcase: "error",
    "no-console": "warn",
    "prefer-const": "error",
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", ["parent", "sibling"], "internal", "index"],
        "newlines-between": "always",
        alphabetize: { order: "asc" },
      },
    ],
    "prettier/prettier": ["error", { endOfLine: "auto" }],
  },
}
