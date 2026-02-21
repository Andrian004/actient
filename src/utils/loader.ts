import { createRequire } from "module";
const require = createRequire(import.meta.url);

export function loadPackage<T>(packageName: string): T {
  try {
    return require(packageName);
  } catch (err: any) {
    if (err?.code === "MODULE_NOT_FOUND") {
      throw new Error(
        `This feature requires "${packageName}". Install it with:\n` +
          `npm install ${packageName}`,
      );
    }
    throw err;
  }
}
