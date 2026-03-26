export interface ScanPass {
  label: string
  target: string
  flags: string[]
}

export interface EcosystemConfig {
  name: string
  installPattern: RegExp
  lockfiles: string[]
  scanPasses: ScanPass[]
}

export const ECOSYSTEMS: EcosystemConfig[] = [
  {
    name: "npm/yarn/pnpm/bun",
    installPattern:
      /\b(npm|pnpm|yarn|bun|npx|bunx)\s+(?:(?:run|exec|dlx)\s+)?(?:install|add|ci|update|upgrade|i)(?:\s|$|;|&&|\|)/,
    lockfiles: [
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lockb",
    ],
    scanPasses: [
      {
        label: "dependencies",
        target: "node_modules/",
        flags: ["--no-git-ignore", "--exclude=!node_modules"],
      },
      {
        label: "source",
        target: ".",
        flags: [],
      },
    ],
  },
  {
    name: "composer",
    installPattern:
      /\bcomposer\s+(?:install|require|update|dump-autoload)(?:\s|$|;|&&|\|)/,
    lockfiles: ["composer.lock"],
    scanPasses: [
      {
        label: "dependencies",
        target: "vendor/",
        flags: ["--no-git-ignore", "--exclude=!vendor"],
      },
      {
        label: "source",
        target: ".",
        flags: [],
      },
    ],
  },
  {
    name: "dotnet/nuget",
    installPattern:
      /\b(?:dotnet\s+(?:restore|add\s+package|build)|nuget\s+(?:install|restore|update))(?:\s|$|;|&&|\|)/,
    lockfiles: [
      "packages.lock.json",
      "obj/project.assets.json",
    ],
    scanPasses: [
      {
        label: "source",
        target: ".",
        flags: [],
      },
    ],
  },
  {
    name: "bundler/gem",
    installPattern:
      /\b(?:bundle\s+(?:install|update|add)|gem\s+install)(?:\s|$|;|&&|\|)/,
    lockfiles: ["Gemfile.lock"],
    scanPasses: [
      {
        label: "dependencies",
        target: "vendor/bundle/",
        flags: ["--no-git-ignore", "--exclude=!vendor"],
      },
      {
        label: "source",
        target: ".",
        flags: [],
      },
    ],
  },
  {
    name: "maven/gradle",
    installPattern:
      /\b(?:mvn\s+(?:install|dependency:resolve|dependency:copy-dependencies|package|compile|verify)|gradle\s+(?:build|dependencies|assemble|compileJava)|\.\/gradlew\s+(?:build|dependencies|assemble|compileJava))(?:\s|$|;|&&|\|)/,
    lockfiles: [
      "gradle.lockfile",
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
    ],
    scanPasses: [
      {
        label: "source",
        target: ".",
        flags: [],
      },
    ],
  },
  {
    name: "pip/poetry/pipenv/uv",
    installPattern:
      /\b(?:pip3?\s+install|poetry\s+(?:install|add|update)|pipenv\s+(?:install|update)|uv\s+(?:pip\s+install|sync|add))(?:\s|$|;|&&|\|)/,
    lockfiles: [
      "poetry.lock",
      "Pipfile.lock",
      "requirements.txt",
      "uv.lock",
    ],
    scanPasses: [
      {
        label: "source",
        target: ".",
        flags: [],
      },
    ],
  },
  {
    name: "cargo",
    installPattern:
      /\bcargo\s+(?:build|add|update|install|fetch)(?:\s|$|;|&&|\|)/,
    lockfiles: ["Cargo.lock"],
    scanPasses: [
      {
        label: "source",
        target: ".",
        flags: [],
      },
    ],
  },
  {
    name: "go modules",
    installPattern:
      /\bgo\s+(?:get|mod\s+(?:download|tidy)|build|install)(?:\s|$|;|&&|\|)/,
    lockfiles: ["go.sum"],
    scanPasses: [
      {
        label: "source",
        target: ".",
        flags: [],
      },
    ],
  },
  {
    name: "conan/vcpkg",
    installPattern:
      /\b(?:conan\s+install|vcpkg\s+install)(?:\s|$|;|&&|\|)/,
    lockfiles: [
      "conan.lock",
      "vcpkg.json",
    ],
    scanPasses: [
      {
        label: "source",
        target: ".",
        flags: [],
      },
    ],
  },
]
