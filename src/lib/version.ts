import pkg from "../../package.json";

export interface AppVersionInfo {
  version: string;
  commit: string | null;
  buildDate: string | null;
}

export function getAppVersionInfo(): AppVersionInfo {
  return {
    version: process.env.APP_VERSION?.trim() || pkg.version,
    commit: process.env.APP_COMMIT?.trim() || null,
    buildDate: process.env.APP_BUILD_DATE?.trim() || null,
  };
}
