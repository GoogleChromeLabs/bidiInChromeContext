/**
 * Copyright 2022 Google LLC.
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
    mocha: true,
    node: true,
  },
  globals: {
    globalThis: false,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      // keep-sorted start
      'src/bidiMapper/tsconfig.json',
      'src/bidiServer/tsconfig.json',
      'src/bidiTab/tsconfig.json',
      'src/cdp/tsconfig.json',
      'src/protocol-parser/tsconfig.json',
      'src/protocol/tsconfig.json',
      'src/tsconfig.json',
      'src/utils/tsconfig.json',
      'tsconfig.base.json',
      // keep-sorted end
    ],
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'mocha',
    "promise",
  ],
  extends: [
    // keep-sorted start
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:prettier/recommended',
    'plugin:promise/recommended',
    // keep-sorted end
  ],
  rules: {
    // https://denar90.github.io/eslint.github.io/docs/rules/
    // Some rules use 'warn' in order to ease local development iteration.
    // keep-sorted start
    '@typescript-eslint/array-type': 'warn',
    '@typescript-eslint/consistent-generic-constructors': 'warn',
    '@typescript-eslint/consistent-type-imports': ['warn', {fixStyle: 'inline-type-imports'}],
    '@typescript-eslint/explicit-member-accessibility': ['warn', {accessibility: 'no-public'}],
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-extraneous-class': 'warn',
    '@typescript-eslint/no-import-type-side-effects': "error",
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', {argsIgnorePattern: '^_'}],
    '@typescript-eslint/prefer-return-this-type': 'warn',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/restrict-template-expressions': 'warn',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    'func-names': 'error',
    'import/first': 'error',
    'import/newline-after-import': 'warn',
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'off',
    'import/order': ['warn', {'newlines-between': 'always'}],
    'no-console': 'warn',
    'no-else-return': 'warn',
    'no-empty': ['warn', {allowEmptyCatch: true}],
    'no-implicit-coercion': 'error',
    'no-negated-condition': 'error',
    'no-return-await': 'warn',
    'no-undef': 'error',
    'no-underscore-dangle': 'error',
    'object-shorthand': 'error',
    'prefer-promise-reject-errors': 'error',
    'prefer-template': 'error',
    eqeqeq: 'error',
    // keep-sorted end
  },
};
