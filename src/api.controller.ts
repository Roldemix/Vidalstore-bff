import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { reenviar } from './reenviar';

interface Juego {
  id: string;
  titulo: string;
  precio: number;
}
interface Licencia {
  juegoId: string;
  [campo: string]: unknown;
}

// El BFF autentica (401), autoriza por cognito:groups (403) y compone. No publica eventos.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiController {
  private readonly logger = new Logger(ApiController.name);
  private readonly catalogo: string;
  private readonly licencias: string;
  private readonly eventos: string;

  constructor(config: ConfigService) {
    this.catalogo = config.getOrThrow<string>('CATALOGO_URL');
    this.licencias = config.getOrThrow<string>('LICENCIAS_URL');
    this.eventos = config.getOrThrow<string>('EVENTOS_URL');
  }

  @Get('catalogo')
  listarCatalogo(@Headers('authorization') auth: string) {
    return reenviar(this.catalogo, 'GET', '/catalogo', auth);
  }

  @Post('catalogo')
  @Roles('editores', 'administradores')
  crearJuego(@Headers('authorization') auth: string, @Body() body: unknown) {
    return reenviar(this.catalogo, 'POST', '/catalogo', auth, body);
  }

  @Put('catalogo/:juegoId')
  @Roles('editores', 'administradores')
  actualizarJuego(
    @Headers('authorization') auth: string,
    @Param('juegoId') juegoId: string,
    @Body() body: unknown,
  ) {
    return reenviar(this.catalogo, 'PUT', `/catalogo/${encodeURIComponent(juegoId)}`, auth, body);
  }

  @Post('compras')
  comprar(@Headers('authorization') auth: string, @Body() body: unknown) {
    // licencias-service descarta todo lo que no sea juegoId y toma el sub del token
    return reenviar(this.licencias, 'POST', '/compras', auth, body);
  }

  @Get('biblioteca')
  async biblioteca(@Headers('authorization') auth: string) {
    const [licencias, juegos] = await Promise.all([
      reenviar<Licencia[]>(this.licencias, 'GET', '/biblioteca', auth),
      reenviar<Juego[]>(this.catalogo, 'GET', '/catalogo', auth).catch((err) => {
        this.logger.warn(`Catálogo no disponible; la biblioteca sale sin títulos: ${err.message}`);
        return null;
      }),
    ]);
    const titulos = new Map((juegos ?? []).map((j) => [j.id, j.titulo]));
    return licencias.map((l) => ({ ...l, titulo: titulos.get(l.juegoId) ?? null }));
  }

  @Get('licencias')
  @Roles('administradores')
  listarLicencias(@Headers('authorization') auth: string) {
    return reenviar(this.licencias, 'GET', '/licencias', auth);
  }

  @Delete('licencias/:licenciaId')
  @Roles('administradores')
  revocar(
    @Headers('authorization') auth: string,
    @Param('licenciaId', new ParseUUIDPipe()) licenciaId: string,
    @Body() body: unknown,
  ) {
    return reenviar(this.licencias, 'DELETE', `/licencias/${licenciaId}`, auth, body);
  }

  @Get('panel/en-vivo')
  @Roles('administradores')
  panelEnVivo(@Headers('authorization') auth: string) {
    return reenviar(this.eventos, 'GET', '/panel/en-vivo', auth);
  }
}