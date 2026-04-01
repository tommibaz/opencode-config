import type { Plugin } from "@opencode-ai/plugin"

export const FeaturePlanningAssistant: Plugin = async ({ client }) => {
  let featurePlanningActive = false
  let interactionCount = 0

  const FOLLOW_UP_SUGGESTIONS = [
    "Refine the user stories further",
    "Add more acceptance criteria",
    "Split a story that's too large",
    "Adjust estimation or priority",
    "Generate the final feature spec",
    "Start a new feature",
  ]

  const safeToast = async (message: string) => {
    try {
      await client.tui.showToast({
        body: { message, variant: "info" },
      })
    } catch {
      // Toast not available (e.g., running in CLI mode)
    }
  }

  await client.app.log({
    body: {
      service: "feature-planning",
      level: "info",
      message: "Feature planning assistant plugin loaded",
    },
  })

  return {
    "tool.execute.after": async (input) => {
      if (input.tool === "feature-planning") {
        featurePlanningActive = true
        interactionCount = 0
        await client.app.log({
          body: {
            service: "feature-planning",
            level: "info",
            message: "Feature planning session started via tool",
          },
        })
      }

      if (input.tool === "skill" && input.args?.name === "feature-planning") {
        featurePlanningActive = true
        interactionCount = 0
        await client.app.log({
          body: {
            service: "feature-planning",
            level: "info",
            message: "Feature planning session started via skill",
          },
        })
      }
    },

    event: async ({ event }) => {
      if (!featurePlanningActive) return
      if (event.type !== "session.idle") return

      interactionCount++

      const suggestionIndex =
        Math.min(interactionCount - 1, FOLLOW_UP_SUGGESTIONS.length - 1)
      const suggestion = FOLLOW_UP_SUGGESTIONS[suggestionIndex]

      await safeToast(`Feature planning: ${suggestion}`)

      if (interactionCount >= FOLLOW_UP_SUGGESTIONS.length) {
        featurePlanningActive = false
        interactionCount = 0
        await client.app.log({
          body: {
            service: "feature-planning",
            level: "info",
            message: "Feature planning session ended",
          },
        })
      }
    },
  }
}
