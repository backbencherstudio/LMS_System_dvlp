import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
// import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service'; // Import AuthService
import appConfig from '../../../config/app.config'; // You can configure Google credentials from a config file
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService, // Inject AuthService to call the authenticateUser function
  ) {
    super({
      clientID: appConfig().auth.google.app_id, // Google Client ID
      clientSecret: appConfig().auth.google.app_secret, // Google Client Secret
      callbackURL: appConfig().auth.google.callback, // Redirect URI
      scope: ['email', 'profile', 'openid'], // Scopes for Google login
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    console.log(accessToken, refreshToken, profile);

    // Check if the user exists in the database by Google ID
    let user = await this.prisma.user.findUnique({
      where: {
        googleId: id, // Find user by Google ID
      },
    });

    if (!user) {
      // If the user doesn't exist, create a new user
      user = await this.prisma.user.create({
        data: {
          googleId: id, // Store Google ID for OAuth
          email: emails[0].value,
          firstName: name.givenName,
          lastName: name.familyName,
          picture: photos[0].value,
          accessToken,
          refreshToken,
        },
      });
    }

    // After user is successfully found or created, log them in and return JWT tokens
    const loginResponse = await this.authService.authenticateUser({
      email: user.email,
      userId: user.id,
    });

    done(null, { user, loginResponse }); // Return user and JWT tokens
  }
}