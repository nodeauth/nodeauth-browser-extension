import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// 1. 读取配置
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const version = pkg.version;
// 对 platform 参数进行严格白名单校验，阻断 CodeQL indirect-command-line-injection 污点链
const ALLOWED_PLATFORMS = ['chrome', 'firefox', 'source'];
const rawPlatform = process.argv.find(arg => arg.startsWith('--platform='))?.split('=')[1] || 'chrome';
if (!ALLOWED_PLATFORMS.includes(rawPlatform)) {
  console.error(`❌ 非法的 platform 参数: "${rawPlatform}"，允许值为: ${ALLOWED_PLATFORMS.join(', ')}`);
  process.exit(1);
}
const platform = rawPlatform;

const distDir = path.join(rootDir, 'dist');
const releaseDir = path.join(rootDir, 'release');

console.log(`🚀 Starting build for ${platform} v${version}...`);

try {
  // source 平台：专门为 Mozilla 审核生成源码压缩包，无需 Vite 编译
  if (platform === 'source') {
    if (!fs.existsSync(releaseDir)) {
      fs.mkdirSync(releaseDir);
    }
    const srcZipName = `nodeauth-source-v${version}.zip`;
    const srcZipPath = path.join(releaseDir, srcZipName);
    if (fs.existsSync(srcZipPath)) {
      fs.unlinkSync(srcZipPath);
    }
    console.log(`📁 Packaging source code into ${srcZipName}...`);
    execSync(
      `zip -r "${srcZipPath}" . -x "node_modules/*" "dist/*" "release/*" ".git/*" "*.DS_Store" "__MACOSX*"`,
      { cwd: rootDir, stdio: 'inherit' }
    );
    console.log(`\n✅ Source package complete: ${srcZipPath}`);
    process.exit(0);
  }

  // 2. 执行基础编译
  console.log('📦 Compiling project...');
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

  // 3. 处理平台差异
  const targetManifestPath = path.join(distDir, 'manifest.json');
  if (platform === 'firefox') {
    console.log('🦊 Adapting for Firefox...');
    const firefoxManifest = path.join(distDir, 'manifest-firefox.json');

    if (fs.existsSync(firefoxManifest)) {
      fs.renameSync(firefoxManifest, targetManifestPath);
    } else {
      console.warn('⚠️ manifest-firefox.json not found, skipping rename.');
    }
  } else {
    // Chrome 分支：删除 Firefox 的备份文件
    const firefoxManifest = path.join(distDir, 'manifest-firefox.json');
    if (fs.existsSync(firefoxManifest)) {
      fs.unlinkSync(firefoxManifest);
    }
  }

  // 3.5 同步版本号从 package.json 到 manifest.json
  // 使用 try/catch 替代 existsSync + readFileSync 模式，消除 TOCTOU 文件竞态警告
  try {
    console.log(`📌 Syncing version v${version} to manifest.json...`);
    const manifest = JSON.parse(fs.readFileSync(targetManifestPath, 'utf-8'));
    manifest.version = version;
    fs.writeFileSync(targetManifestPath, JSON.stringify(manifest, null, 2));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e; // 文件不存在时静默跳过，其他错误继续抛出
    console.warn('⚠️ manifest.json not found, skipping version sync.');
  }

  // 4. 确保 release 目录存在
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir);
  }

  // 5. 执行打包
  const zipName = `nodeauth-extension-v${version}-${platform}.zip`;
  const zipPath = path.join(releaseDir, zipName);

  // 清理旧的同名包
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  console.log(`🤐 Zipping into ${zipName}...`);
  // 使用 spawnSync 参数数组替代 execSync 字符串拼接，阻断 CodeQL indirect-command-line-injection 污点链
  // zipPath 来自白名单校验后的 platform，但 spawnSync 数组参数模式本身不经过 shell 解析，从根本上消除注入风险
  const zipResult = spawnSync('zip', ['-r', zipPath, '.', '-x', '*.DS_Store', '__MACOSX*', '*.git*'], {
    cwd: distDir,
    stdio: 'inherit'
  });
  if (zipResult.status !== 0) {
    throw new Error(`zip 命令执行失败，退出码: ${zipResult.status}`);
  }

  console.log(`\n✅ Build complete: ${zipPath}`);
} catch (error) {
  console.error('\n❌ Build failed:');
  console.error(error.message);
  process.exit(1);
}
