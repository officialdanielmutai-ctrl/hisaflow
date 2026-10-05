import { BadRequestException, HttpException } from '@nestjs/common';
import { AllExceptionsFilter } from './exception.filter';

function buildHost() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host: any = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/test/url' }),
    }),
  };
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('maps an HttpException with a string response', () => {
    const { host, status, json } = buildHost();
    const filter = new AllExceptionsFilter();

    filter.catch(new HttpException('Nope', 403), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: 'Nope', path: '/test/url' }),
    );
  });

  it('preserves structured extra fields on an object response', () => {
    const { host, status, json } = buildHost();
    const filter = new AllExceptionsFilter();

    filter.catch(
      new HttpException({ message: 'Feature locked', reason: 'tier', paywallUrl: '/paywall' }, 402),
      host,
    );

    expect(status).toHaveBeenCalledWith(402);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 402,
        message: 'Feature locked',
        reason: 'tier',
        paywallUrl: '/paywall',
      }),
    );
  });

  it('joins an array of validation messages', () => {
    const { host, json } = buildHost();
    const filter = new AllExceptionsFilter();

    filter.catch(new BadRequestException(['name should not be empty', 'age must be a number']), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'name should not be empty, age must be a number' }),
    );
  });

  it('falls back to a 500 for a non-HttpException', () => {
    const { host, status, json } = buildHost();
    const filter = new AllExceptionsFilter();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
  });

  it('always includes a timestamp', () => {
    const { host, json } = buildHost();
    const filter = new AllExceptionsFilter();

    filter.catch(new Error('boom'), host);

    expect(json.mock.calls[0][0].timestamp).toEqual(expect.any(String));
  });
});
