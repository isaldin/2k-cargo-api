import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from '../session/session.service';
import { ApiSession } from '../session/session.entity';

interface RequestWithSession extends Request {
  session: ApiSession;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Bearer token');
    }

    const token = header.slice(7).trim();
    const session = await this.sessionService.findByToken(token);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.session = session;
    return true;
  }
}
