import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const OrgContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['x-organization-id'] as string;
  },
);
