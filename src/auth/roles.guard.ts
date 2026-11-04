import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // ruta sin restricción de grupo
    }

    const request = context.switchToHttp().getRequest();
    const userGroups: string[] = request.user?.['cognito:groups'] || [];

    const hasRole = requiredRoles.some((role) => userGroups.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('No tienes permiso para esta operación');
    }

    return true;
  }
}