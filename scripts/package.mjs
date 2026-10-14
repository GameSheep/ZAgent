import { copyFile, mkdir, readFile, stat, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const destination = path.resolve('dist', manifest.id);
const files = ['main.js', 'manifest.json', 'styles.css', 'README.md', 'LICENSE'];
await mkdir(destination, { recursive: true });
for (const file of files) {
  if (!(await stat(file)).size) throw new Error(`Empty release file: ${file}`);
  await copyFile(file, path.join(destination, file));
}
const archive = path.resolve('dist', `${manifest.id}-${manifest.version}.zip`);
if (process.platform === 'win32') {
  const psQuote = value => `'${value.replace(/'/g, "''")}'`;
  await rm(archive, { force: true });
  const code = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open(${psQuote(archive)}, 'Create')
try {
  foreach ($file in @(${files.map(psQuote).join(',')})) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, [IO.Path]::Combine(${psQuote(destination)}, $file), ${psQuote(manifest.id + '/')} + $file, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }`;
  execFileSync('powershell.exe', ['-NoProfile', '-Command', code], { stdio: 'inherit', windowsHide: true });
} else {
  execFileSync('zip', ['-qr', archive, manifest.id], { cwd: path.resolve('dist'), stdio: 'inherit' });
}
console.log(`Release directory: ${destination}`);
console.log(`Installable ZIP: ${archive}`);
