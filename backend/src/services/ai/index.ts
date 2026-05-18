import { env } from "../../config/env";
import { AiClassifierService } from "./AiClassifierService";
import { MockAiClassifierService } from "./MockAiClassifierService";

let instance: AiClassifierService | null = null;

/** Returns the configured AI classifier (mock by default). */
export function getAiClassifier(): AiClassifierService {
  if (instance) return instance;
  switch (env.aiProvider) {
    // case "openai": instance = new OpenAiClassifierService(); break;  // Phase 2
    // case "claude": instance = new ClaudeClassifierService(); break;
    default:
      instance = new MockAiClassifierService();
  }
  return instance;
}

export * from "./AiClassifierService";
