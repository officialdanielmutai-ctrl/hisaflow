import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { AiIngestionService } from '../ai-ingestion/ai-ingestion.service';

const ORG = 'org_1';

function build(opts: { text?: string; actions?: unknown[] } = {}) {
  const ocr = {
    extractTextFromImage: jest.fn(async () => ({ text: opts.text ?? 'RICE 2KG 200' })),
  } as unknown as OcrService;
  const ai = {
    warmInventoryContext: jest.fn(async () => undefined),
    parseInventoryText: jest.fn(async () => opts.actions ?? [{ type: 'SALE' }]),
  } as unknown as AiIngestionService;
  const controller = new OcrController(ocr, ai);
  return { controller, ocr, ai };
}

const file = { buffer: Buffer.from('image'), mimetype: 'image/jpeg' } as Express.Multer.File;

describe('OcrController', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /ocr/receipt', () => {
    it('delegates to the OCR service', async () => {
      const { controller, ocr } = build({ text: 'raw' });

      await expect(controller.extractReceipt(file, ORG)).resolves.toEqual({ text: 'raw' });
      expect(ocr.extractTextFromImage).toHaveBeenCalledWith(file.buffer, 'image/jpeg');
    });
  });

  describe('POST /ocr/receipt/parse', () => {
    it('warms the inventory context, OCRs, then parses in one call', async () => {
      const { controller, ocr, ai } = build();

      const result = await controller.extractAndParse(file, ORG, undefined);

      expect(ai.warmInventoryContext).toHaveBeenCalledWith(ORG);
      expect(ocr.extractTextFromImage).toHaveBeenCalledWith(file.buffer, 'image/jpeg');
      expect(ai.parseInventoryText).toHaveBeenCalledWith('RICE 2KG 200', ORG, 'RECEIPT_OCR');
      expect(result).toEqual({ text: 'RICE 2KG 200', actions: [{ type: 'SALE' }] });
    });

    it('honours the label source when asked', async () => {
      const { controller, ai } = build();

      await controller.extractAndParse(file, ORG, 'LABEL_OCR');

      expect(ai.parseInventoryText).toHaveBeenCalledWith(expect.any(String), ORG, 'LABEL_OCR');
    });

    it('skips parsing and returns empty actions when no text was read', async () => {
      const { controller, ai } = build({ text: '   ' });

      const result = await controller.extractAndParse(file, ORG, undefined);

      expect(ai.parseInventoryText).not.toHaveBeenCalled();
      expect(result).toEqual({ text: '', actions: [] });
    });
  });
});
