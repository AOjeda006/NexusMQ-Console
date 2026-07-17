import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { type LoginBody, loginSchema } from './auth.schemas';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './session-cookie';

/** ¿Hay sesión de operador activa? Es lo único que el navegador debe saber. */
interface SessionStatus {
  readonly authenticated: boolean;
}

/**
 * Endpoints de sesión del BFF. **Nunca** devuelven el token del broker: el login
 * lo confina en servidor y responde solo con la cookie httpOnly y el estado de
 * autenticación.
 */
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginBody,
    @Res() res: Response,
  ): Promise<void> {
    const cookie = await this.auth.login(body.token);
    res.cookie(SESSION_COOKIE_NAME, cookie, sessionCookieOptions(this.auth.sessionTtlMs));
    res.status(200).json({ authenticated: true } satisfies SessionStatus);
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    this.auth.logout(req.headers.cookie);
    res.clearCookie(SESSION_COOKIE_NAME, { ...sessionCookieOptions(), maxAge: undefined });
    res.status(200).json({ authenticated: false } satisfies SessionStatus);
  }

  @Get('session')
  session(@Req() req: Request): SessionStatus {
    return { authenticated: this.auth.isAuthenticated(req.headers.cookie) };
  }
}
