import { env } from "../../config/env";
import { MockOcrService } from "./MockOcrService";
import { OcrService } from "./OcrService";

let instance: OcrService | null = null;

/** Returns the configured OCR provider (mock by default). */
export function getOcrService(): OcrService {
  if (instance) return instance;
  switch (env.ocrProvider) {
    // case "clova": instance = new ClovaOcrService(); break;     // Phase 2
    // case "textract": instance = new TextractOcrService(); break;
    default:
      instance = new MockOcrService();
  }
  return instance;
}

export * from "./OcrService";
