import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  schoolId: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'super-secret-jwt-key-change-in-production-min-32-chars'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        profile: true,
        userRoles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    const roles = user.userRoles.map((r) => r.role);

    return {
      id: user.id,
      email: user.email,
      schoolId: user.profile?.schoolId || payload.schoolId,
      profile: user.profile,
      roles,
      activeRole: roles[0] || 'student',
    };
  }
}
