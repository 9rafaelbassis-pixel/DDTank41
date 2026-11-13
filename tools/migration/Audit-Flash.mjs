// Scan original Flash binaries locally without publishing, modifying or executing them.
// Usage: node tools/migration/Audit-Flash.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const allowedRoots = ['Source Flash/FlashSV1', 'Tank.Flash', 'Road.Flash'];
const out = [];
function visit(dir, depth) {
  if (depth > 6 || !fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['obj', 'bin', 'node_modules', '.git'].includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) { visit(abs, depth + 1); continue; }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.swf')) continue;
    const stat = fs.statSync(abs);
    const handle = fs.openSync(abs, 'r');
    const first = Buffer.alloc(8);
    fs.readSync(handle, first, 0, 8, 0);
    fs.closeSync(handle);
    const sig = first.toString('ascii', 0, 3);
    const hash = crypto.createHash('sha256');
    const data = fs.readFileSync(abs);
    hash.update(data);
    out.push({ file: path.relative(root, abs).replaceAll('\\','/'),
      signature: sig, validSignature: ['FWS','CWS','ZWS'].includes(sig),
      flashVersion: first[3], declaredUncompressedBytes: first.readUInt32LE(4),
      bytes: stat.size, sha256: hash.digest('hex') });
  }
}
for (const relative of allowedRoots) visit(path.join(root, relative), 0);
const report = { generatedAt: new Date().toISOString(), rootPaths: allowedRoots, swf: out };
const outDir = path.join(root, 'migration-output');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'flash-report.json'), JSON.stringify(report,null,2)+'\n');
console.log('SWFs localizados: '+out.length+', arquivos válidos: '+out.filter(x=>x.validSignature).length);
console.log('Relatório: migration-output/flash-report.json');
