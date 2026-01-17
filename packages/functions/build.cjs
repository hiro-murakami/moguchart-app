const { build, context } = require('esbuild');
const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');
const { execSync } = require('child_process');

// dependencies に記載されているパッケージはバンドルから除外（external）し、
// デプロイ先の node_modules を利用させる。
// devDependencies に移動した @moguchart/shared はここに含まれないため、バンドルされる。
const external = Object.keys(pkg.dependencies || {});

const isWatch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22', // package.json の engines に合わせる
  format: 'esm',    // type: "module" なので ESM 形式で出力
  outfile: 'dist/index.js',
  external,
  logLevel: 'info',
  sourcemap: true,
};

function copyFiles() {
  // dist ディレクトリの作成
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }

  // 1. package.json の生成（デプロイ用）
  const distPkg = { ...pkg };

  // workspace:* を含む devDependencies はデプロイ先でエラーになるため削除
  delete distPkg.devDependencies;

  // エントリーポイントを修正
  distPkg.main = 'index.js';

  // デプロイ先で Prisma Client を生成するためのスクリプトを追加
  distPkg.scripts = {
    "postinstall": "prisma generate"
  };

  // Prisma CLI はデプロイ先での generate に必要なので dependencies に追加しておく
  if (pkg.devDependencies && pkg.devDependencies.prisma) {
    distPkg.dependencies = distPkg.dependencies || {};
    distPkg.dependencies.prisma = pkg.devDependencies.prisma;
  }

  fs.writeFileSync('dist/package.json', JSON.stringify(distPkg, null, 2));

  // 2. schema.prisma のコピー
  // Prisma のスキーマファイルがないと実行時にエラーになる可能性があるためコピー
  if (fs.existsSync('prisma/schema.prisma')) {
    if (!fs.existsSync('dist/prisma')) {
      fs.mkdirSync('dist/prisma');
    }
    fs.copyFileSync('prisma/schema.prisma', 'dist/prisma/schema.prisma');
  }

  // .env ファイルのコピー
  if (fs.existsSync('.env')) {
    fs.copyFileSync('.env', 'dist/.env');
  }

  console.log('Build artifacts copied to dist/');

  // 3. 依存関係のインストール
  // Firebase CLI が SDK の位置を特定できるように、dist 内で依存関係をインストールする
  console.log('Installing dependencies in dist/...');
  try {
    execSync('npm install --omit=dev', { cwd: 'dist', stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to install dependencies in dist:', e);
  }
}

(async () => {
  try {
    if (isWatch) {
      const ctx = await context({
        ...options,
        plugins: [{
          name: 'copy-files',
          setup(build) {
            build.onEnd(() => copyFiles());
          }
        }]
      });
      await ctx.watch();
    } else {
      await build(options);
      copyFiles();
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
