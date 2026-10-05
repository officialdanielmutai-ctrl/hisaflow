import { InternalServerErrorException } from '@nestjs/common';
import { OcrService } from './ocr.service';

const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;

function makeService(key?: string) {
  if (key === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = key;
  return new OcrService();
}

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
  jest.restoreAllMocks();
});

describe('OcrService', () => {
  it('fails fast when the Gemini key is not configured', async () => {
    const service = makeService(undefined);

    await expect(service.extractTextFromImage(Buffer.from('x'))).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('returns the text extracted by the vision model', async () => {
    const service = makeService('test-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '[CONFIDENCE: HIGH] Rice 2kg' }] } }],
      }),
    }) as unknown as typeof fetch;

    await expect(service.extractTextFromImage(Buffer.from('x'))).resolves.toEqual({
      text: '[CONFIDENCE: HIGH] Rice 2kg',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns empty text when the model reports NO_TEXT_FOUND', async () => {
    const service = makeService('test-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'NO_TEXT_FOUND' }] } }] }),
    }) as unknown as typeof fetch;

    await expect(service.extractTextFromImage(Buffer.from('x'))).resolves.toEqual({ text: '' });
  });

  it('surfaces a provider HTTP error as a 500', async () => {
    const service = makeService('test-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'quota' }),
    }) as unknown as typeof fetch;

    await expect(service.extractTextFromImage(Buffer.from('x'))).rejects.toThrow(
      'Gemini Vision API returned 429',
    );
  });

  it('wraps a network failure as a 500', async () => {
    const service = makeService('test-key');
    global.fetch = jest.fn().mockRejectedValue(new Error('socket hang up')) as unknown as typeof fetch;

    await expect(service.extractTextFromImage(Buffer.from('x'))).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
