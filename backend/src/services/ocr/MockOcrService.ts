import { OcrResult, OcrService } from "./OcrService";

/**
 * Deterministic stand-in for a real OCR provider so Phase 1 runs without
 * external API keys. Returns plausible receipt fields with a confidence
 * score the import flow uses to flag NEEDS_REVISION.
 */
export class MockOcrService implements OcrService {
  readonly name = "mock";

  async recognize(): Promise<OcrResult> {
    return {
      rawText:
        "텀블러비어 역삼직영점\n2026-03-03\n승인번호 30395976\n합계 194,500원\n부가세 17,681원",
      fields: {
        merchantName: "텀블러비어역삼직영점",
        transactionDate: "2026-03-03",
        amount: 194500,
        vatAmount: 17681,
        approvalNumber: "30395976",
        paymentMethod: "CARD",
      },
      confidence: 0.62,
    };
  }
}
