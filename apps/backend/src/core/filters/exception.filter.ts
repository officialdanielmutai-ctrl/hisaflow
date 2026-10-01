import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        // Preserve structured fields (e.g. the tier gate's reason/feature/
        // paywallUrl) instead of flattening every error to `message`.
        const { message: resMessage, ...rest } = res as Record<string, unknown>;
        if (typeof resMessage === 'string') {
          message = resMessage;
        } else if (Array.isArray(resMessage)) {
          message = resMessage.join(', ');
        }
        extra = rest;
      }
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...extra,
    });
  }
}
