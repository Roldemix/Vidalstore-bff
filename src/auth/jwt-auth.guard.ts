import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

function crearVerificador(userPoolId: string, clientIds: string[]) {
  return CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId: clientIds });
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly verifier: ReturnType<typeof crearVerificador>;

  constructor(config: ConfigService) {
    this.verifier = crearVerificador(
      config.getOrThrow<string>('COGNITO_USER_POOL_ID'),
      config.getOrThrow<string>('COGNITO_CLIENT_IDS').split(',').map((s) => s.trim()),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }
    try {
      request.user = await this.verifier.verify(header.slice(7));
      return true;
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      throw new UnauthorizedException(`Token inválido: ${detalle}`);
    }
  }
}