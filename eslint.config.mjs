/**
 * Copyright 2024 Google LLC.
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
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {fixupConfigRules, fixupPluginRules} from '@eslint/compat';
import {FlatCompat} from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import _import from 'eslint-plugin-import';
import mocha from 'eslint-plugin-mocha';
import promise from 'eslint-plugin-promise';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

/**
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  {
    ignores: [
      '**/.mypy_cache/',
      '**/.pytest_cache/',
      '**/__pycache__',
      '**/.build',
      '**/.cache',
      '**/.idea',
      '**/chromium-bidi-*',
      '**/chromium-bidi.iml',
      '**/*.py.ini',
      '**/lib/',
      '**/logs/',
      '**/node_modules/',
      '**/wptreport*.json',
      'tests/',
      'wpt/',
      'wpt-metadata/*/',
      'src/protocol/generated/',
      'src/protocol-parser/generated/',
    ],
  },
  ...fixupConfigRules(
    compat.extends(
      'eslint:recommended',
      'plugin:import/typescript',
      'plugin:mocha/recommended',
      'plugin:prettier/recommended',
      'plugin:promise/recommended'
    )
  ),
  {
    name: 'JavaScript rules',

    plugins: {
      import: fixupPluginRules(_import),
      mocha: fixupPluginRules(mocha),
      promise: fixupPluginRules(promise),
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.mocha,
        ...globals.node,
        globalThis: false,
      },

      parser: tsParser,
    },

    settings: {
      'import/resolver': {
        typescript: true,
      },
    },

    rules: {
      'func-names': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',

      'import/no-cycle': [
        'error',
        {
          maxDepth: Infinity,
        },
      ],

      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off',

      'import/order': [
        'error',
        {
          'newlines-between': 'always',

          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      'mocha/no-exclusive-tests': 'error',
      'mocha/no-mocha-arrows': 'off',
      'mocha/no-setup-in-describe': 'off',
      'no-console': 'warn',
      'no-else-return': 'warn',

      'no-empty': [
        'warn',
        {
          allowEmptyCatch: true,
        },
      ],

      'no-implicit-coercion': 'error',
      'no-negated-condition': 'error',
      'no-undef': 'error',

      'no-underscore-dangle': [
        'error',
        {
          allow: ['__dirname', '__filename'],
        },
      ],

      'object-shorthand': 'error',
      'prefer-promise-reject-errors': 'error',
      'prefer-template': 'error',
      eqeqeq: 'error',
    },
  },
  ...compat
    .extends(
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking'
    )
    .map((config) => ({
      ...config,
      files: ['**/*.ts'],
    })),
  {
    name: 'TypeScript rules',
    files: ['**/*.ts'],

    plugins: {
      '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',

      parserOptions: {
        project: './tsconfig.base.json',
      },
    },

    rules: {
      'no-restricted-syntax': [
        'error',
        {
          message:
            'When `registerPromiseEvent` the `then` need to have a second catch argument',
          selector:
            'CallExpression[callee.property.name="registerPromiseEvent"] > :first-child[callee.property.name="then"][arguments.length<2]',
        },
      ],

      '@typescript-eslint/array-type': 'warn',
      '@typescript-eslint/consistent-generic-constructors': 'warn',

      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          fixStyle: 'inline-type-imports',
        },
      ],

      '@typescript-eslint/explicit-member-accessibility': [
        'warn',
        {
          accessibility: 'no-public',
        },
      ],

      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-extraneous-class': 'warn',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-template-expression': 'error',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],

      '@typescript-eslint/prefer-return-this-type': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/return-await': ['error', 'always'],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unused-expressions': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },
  {
    name: 'Test deps',
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', 'src/bidiServer/**', 'tools/**'],

    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: false,
        },
      ],
    },
  },

  {
    name: 'Fix test unused',
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts'],

    rules: {
      '@typescript-eslint/no-unused-expressions': 'error',
    },
  },
];