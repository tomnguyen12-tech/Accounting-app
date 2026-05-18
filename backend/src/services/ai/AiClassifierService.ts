/**
 * AI extraction/classification abstraction. Phase 2 replaces the mock with
 * OpenAI/Claude. The result always carries a confidenceScore; the import
 * pipeline marks low-confidence transactions as NEEDS_REVISION.
 */
export interface AiClassification {
  category: string;
  confidenceScore: number;
  /** Optional model-suggested memo (never the legally-required purpose). */
  suggestedMemo?: string;
}

export interface AiClassifierInput {
  merchantName: string;
  amount: number;
  transactionDate?: string;
}

export interface AiClassifierService {
  readonly name: string;
  classify(input: AiClassifierInput): Promise<AiClassification>;
}

/** Below this score the transaction must be human-reviewed. */
export const CONFIDENCE_THRESHOLD = 0.7;
