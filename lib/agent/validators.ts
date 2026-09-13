import { z } from "zod";

export const LLMResponseSchema = z.object({
  criticalPoints: z.array(z.string()),
  decisionsTaken: z.array(z.string()),
  pendingTasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      dateTime: z.string(),
      isImplicit: z.boolean(),
    })
  ),
  suggestedActions: z.array(
    z.object({
      type: z.string(),
      channel: z.string(),
      title: z.string(),
      description: z.string(),
      payload: z.record(z.string(), z.any()),
    })
  ),
  summaryMarkdown: z.string(),
});
