import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const schoolId = request.user?.schoolId || request.headers['x-school-id'];

    // Super admin can operate without a school context or specify via header
    if (request.user?.roles?.includes('super_admin')) {
      request.schoolId = schoolId || null;
      return true;
    }

    if (!schoolId) {
      throw new BadRequestException('Multi-tenant violation: Missing school context.');
    }

    request.schoolId = schoolId;
    return true;
  }
}
