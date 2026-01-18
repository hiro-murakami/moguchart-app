module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  // ベースとなる設定（TypeScriptなど共通部分）
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // Prettierとの競合を避けるため最後に記述
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // プロジェクト全体で適用したい共通ルール
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
  },
  overrides: [
    // packages/frontend (Vue) 用の設定
    {
      files: ['packages/frontend/**/*.{ts,vue}'],
      env: {
        browser: true,
      },
      extends: [
        'plugin:vue/vue3-recommended',
        '@vue/typescript/recommended',
        'prettier',
      ],
      parser: 'vue-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
      rules: {
        'vue/multi-word-component-names': 'off',
      },
    },
    // packages/functions 用の設定
    {
      files: ['packages/functions/**/*.ts'],
      // 必要に応じてFunctions固有のルールを追加
    },
  ],
}
