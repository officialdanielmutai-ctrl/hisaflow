import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OcrService } from './ocr.service';

// The service proxies OCR through the LiteLLM gateway via the OpenAI SDK.
// The SDK is mocked so tests never touch a real gateway or provider.
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import OpenAI from 'openai';

const MockedOpenAI = OpenAI as unknown as jest.Mock;

function build(opts: { baseUrl?: string; apiKey?: string; content?: string; reject?: Error } = {}) {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'litellm.baseUrl') return opts.baseUrl;
      if (key === 'litellm.masterKey') return opts.apiKey;
      return undefined;
    }),
  };
  const create = opts.reject
    ? jest.fn().mockRejectedValue(opts.reject)
    : jest.fn().mockResolvedValue({ choices: [{ message: { content: opts.content } }] });
  MockedOpenAI.mockImplementation(() => ({ chat: { completions: { create } } }));
  const service = new OcrService(config as unknown as ConfigService);
  return { service, create };
}

const CONFIGURED = { baseUrl: 'http://litellm.local/v1', apiKey: 'test-key' };

describe('OcrService', () => {
  beforeEach(() => {
    MockedOpenAI.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fails fast when the gateway is not configured', async () => {
    const { service, create } = build();

    await expect(service.extractTextFromImage(Buffer.from('x'))).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the text extracted by the vision model through the gateway', async () => {
    const { service, create } = build({
      ...CONFIGURED,
      content: '[CONFIDENCE: HIGH] Rice 2kg',
    });

    await expect(service.extractTextFromImage(Buffer.from('x'))).resolves.toEqual({
      text: '[CONFIDENCE: HIGH] Rice 2kg',
    });

    const [request] = create.mock.calls[0];
    expect(request.model).toBe('hisaflow-vision');
    expect(request.messages[0].content[1]).toMatchObject({
      type: 'image_url',
      image_url: { url: expect.stringContaining('data:image/jpeg;base64,') },
    });
  });

  it('returns empty text when the model reports NO_TEXT_FOUND', async () => {
    const { service } = build({ ...CONFIGURED, content: 'NO_TEXT_FOUND' });

    await expect(service.extractTextFromImage(Buffer.from('x'))).resolves.toEqual({ text: '' });
  });

  it('surfaces a gateway/provider failure as a 500', async () => {
    const { service } = build({ ...CONFIGURED, reject: new Error('quota exceeded') });

    await expect(service.extractTextFromImage(Buffer.from('x'))).rejects.toThrow(
      'quota exceeded',
    );
  });
});
