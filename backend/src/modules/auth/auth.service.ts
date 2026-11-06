import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        profile: {
          include: {
            school: true,
          },
        },
        userRoles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roles = user.userRoles.map((r) => r.role);
    const schoolId = user.profile?.schoolId;

    const tokens = await this.generateTokens(user.id, user.email, schoolId || '', roles);

    // Store hashed refresh token
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: hashedRefreshToken,
        lastLoginAt: new Date(),
      },
    });

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile,
        roles,
        school: user.profile?.school,
      },
    };
  }

  async registerAdmin(dto: RegisterAdminDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email address already exists');
    }

    // Check if school code exists
    const existingSchool = await this.prisma.school.findUnique({
      where: { code: dto.schoolCode.toUpperCase() },
    });
    if (existingSchool) {
      throw new ConflictException('School code is already taken. Please choose another code.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const slug = dto.schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Transaction to create School, User, Profile, and UserRole
    const result = await this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: dto.schoolName,
          code: dto.schoolCode.toUpperCase(),
          slug: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`,
          phone: dto.schoolPhone,
          currency: dto.currency || 'GHS',
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          phone: dto.phone,
          isVerified: true,
        },
      });

      const profile = await tx.profile.create({
        data: {
          userId: user.id,
          schoolId: school.id,
          fullName: dto.fullName,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          schoolId: school.id,
          role: 'admin',
        },
      });

      return { school, user, profile };
    });

    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.school.id,
      ['admin'],
    );

    return {
      message: 'Institution and Administrator account registered successfully',
      tokens,
      user: {
        id: result.user.id,
        email: result.user.email,
        profile: result.profile,
        roles: ['admin'],
        school: result.school,
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const refreshSecret = this.configService.get<string>(
        'JWT_REFRESH_SECRET',
        'super-secret-refresh-key-change-in-production-min-32-chars',
      );
      const decoded = this.jwtService.verify(dto.refreshToken, { secret: refreshSecret });

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          profile: true,
          userRoles: true,
        },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Access Denied');
      }

      const isTokenValid = await bcrypt.compare(dto.refreshToken, user.refreshToken);
      if (!isTokenValid) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const roles = user.userRoles.map((r) => r.role);
      const schoolId = user.profile?.schoolId || '';

      const tokens = await this.generateTokens(user.id, user.email, schoolId, roles);

      const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefreshToken },
      });

      return tokens;
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        profile: {
          include: {
            school: true,
            student: {
              include: { class: true },
            },
            teacher: true,
            parent: true,
          },
        },
        userRoles: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return {
      ...user,
      roles: user.userRoles.map((r) => r.role),
    };
  }

  private async generateTokens(userId: string, email: string, schoolId: string, roles: string[]) {
    const payload = { sub: userId, email, schoolId, roles };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET', 'super-secret-jwt-key-change-in-production-min-32-chars'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1d'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'super-secret-refresh-key-change-in-production-min-32-chars'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 86400,
    };
  }
}
