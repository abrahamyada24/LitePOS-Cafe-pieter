const fs = require('node:fs');
const path = require('node:path');

// Camera Kit 17.0.1 includes stale generated C++ in its npm package.
// RN 0.83+ uses different class names; regenerate with this app's RN version.
// Upstream: https://github.com/teslamotors/react-native-camera-kit/pull/789
function cleanCameraKitCodegen(projectRoot = path.resolve(__dirname, '..')) {
  const modulesDir = fs.realpathSync(path.join(projectRoot, 'node_modules'));
  const packageDir = fs.realpathSync(path.join(modulesDir, 'react-native-camera-kit'));
  if (path.relative(modulesDir, packageDir) !== 'react-native-camera-kit') {
    throw new Error('Camera Kit resolves outside the expected node_modules directory');
  }
  const {version} = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  if (version !== '17.0.1') return false;

  const target = path.join(packageDir, 'android', 'build');
  if (!fs.existsSync(target)) return false;
  // Refuse symlinks/junctions leading outside the generated build directory.
  const resolved = fs.realpathSync(target);
  if (path.relative(packageDir, resolved) !== path.join('android', 'build')) {
    throw new Error(`Unexpected Camera Kit build directory: ${resolved}`);
  }
  fs.rmSync(target, {recursive: true, force: true});
  console.log(`[Camera Kit] Removed stale generated build output: ${resolved}`);
  return true;
}

if (require.main === module) cleanCameraKitCodegen();
module.exports = {cleanCameraKitCodegen};
