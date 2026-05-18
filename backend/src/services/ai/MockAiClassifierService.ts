import { classifyMerchant } from "../category/categoryRules";
import {
  AiClassification,
  AiClassifierInput,
  AiClassifierService,
} from "./AiClassifierService";

/**
 * Mock classifier backed by the deterministic keyword rules. Same contract
 * as a future LLM-based classifier, so controllers never change.
 */
export class MockAiClassifierService implements AiClassifierService {
  readonly name = "mock";

  async classify(input: AiClassifierInput): Promise<AiClassification> {
    const { category, confidence } = await classifyMerchant(input.merchantName);
    return {
      category,
      confidenceScore: confidence,
      suggestedMemo: undefined,
    };
  }
}
