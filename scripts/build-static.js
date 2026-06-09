const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

// Never ship backend-only files to a public static host. The inquiry log can
// contain customer names and phone numbers, so it must stay out of dist/.
const excluded = new Set(["inquiries.jsonl"]);

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

fs.rmSync(dist, { recursive: true, force: true });
copyDir(path.join(root, "public"), dist);
copyDir(path.join(root, "data"), path.join(dist, "data"));

console.log(`Static site built in ${dist}`);
