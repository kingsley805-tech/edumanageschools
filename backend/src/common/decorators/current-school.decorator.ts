import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentSchool = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // School ID is determined from authenticated JWT token or X-School-ID header for multi-school staff
    return request.user?.schoolId || request.headers['x-school-id'];
  },
);
