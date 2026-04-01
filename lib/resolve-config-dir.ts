import path from "node:path"
import os from "node:os"

export function resolveConfigDir(): string {
  if (process.env.OPENCODE_CONFIG_DIR) {
    return process.env.OPENCODE_CONFIG_DIR
  }
  if (process.env.OPENCODE_CONFIG) {
    return path.dirname(process.env.OPENCODE_CONFIG)
  }
  return path.join(os.homedir(), ".config", "opencode")
}
