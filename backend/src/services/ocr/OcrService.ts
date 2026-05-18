/**
 * OCR provider abstraction. Phase 2 swaps MockOcrService for a real
 * implementation (Naver CLOVA / AWS Textract / Google Vision) without
 * touching controllers. Wire the chosen provider in services/ocr/index.ts.
 */
export interface OcrResult {
  rawText: string;
  /** Best-effort structured fields extracted from a receipt/PDF. */
  fields: {
    merchantName?: string;
    transactionDate?: string;
    amount?: number;
    vatAmount?: number;
    approvalNumber?: string;
    cardNumberMasked?: string;
    paymentMethod?: string;
  };
  confidence: number;
}

export interface OcrService {
  readonly name: string;
  /** Extract text + fields from an image or scanned-PDF buffer. */
  recognize(file: { buffer: Buffer; mimeType: string }): Promise<OcrResult>;
}
