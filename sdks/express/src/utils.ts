import * as fs from 'fs';
import * as path from 'path';

export function discoverServiceName(providedName?: string): string {
  if (providedName) {
    return providedName;
  }

  if (process.env.CERBERUS_SERVICE_NAME) {
    return process.env.CERBERUS_SERVICE_NAME;
  }

  if (process.env.npm_package_name) {
    return process.env.npm_package_name;
  }

  try {
    let currentDir = process.cwd();
    while (currentDir !== path.parse(currentDir).root) {
      const pkgPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkgData = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgData);
        if (pkg.name) {
          return pkg.name;
        }
        break; // Found package.json but no name, don't keep searching
      }
      currentDir = path.dirname(currentDir);
    }
  } catch (err) {
    // Silently ignore errors reading package.json
  }

  return 'unknown-service';
}
