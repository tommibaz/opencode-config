import { ECOSYSTEMS, type EcosystemConfig } from "./ecosystems.ts"

export interface DetectedInstall {
  ecosystem: EcosystemConfig
  command: string
}

export function detectInstalls(command: string): DetectedInstall[] {
  const matches: DetectedInstall[] = []
  for (const eco of ECOSYSTEMS) {
    if (eco.installPattern.test(command)) {
      matches.push({ ecosystem: eco, command })
    }
  }
  return matches
}
