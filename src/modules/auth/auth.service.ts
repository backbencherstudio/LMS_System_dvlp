// external imports
import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';

//internal imports
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { MailService } from '../../mail/mail.service';
import { UcodeRepository } from '../../common/repository/ucode/ucode.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { SojebStorage } from '../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../common/helper/date.helper';
import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import { StringHelper } from '../../common/helper/string.helper';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) { }

  async createUser(data: CreateUserDto, avatar?: Express.Multer.File) {

    const hashedPassword = await bcrypt.hash(data.password, 10);

    if (avatar) {
      const fileName = `${StringHelper.randomString()}${avatar?.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.avatar + fileName,
        avatar?.buffer,
      );

      data.avatar = fileName;
    }
    else {
      data.avatar = 'null';
    }
    const userData = {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      password: hashedPassword,
      phone_number: data.phone_number,
      type: data.type,
      avatar: data.avatar,
      grade_level: data.grade_level,
      highest_education_level: data.highest_education_level,
      teching_experience: data.teching_experience,
      subjects_taught: data.subjects_taught,
      hourly_rate: data.hourly_rate,
      general_availability: data.general_availability,
      is_agreed_terms: data.is_agreed_terms ? 1 : 0,
      is_agree_application_process: data.is_agree_application_process ? 1 : 0,
      city: data.city,
      about_me: data.about_me,
      name: `${data.first_name} ${data.last_name}`,
    };

    if (data.type === 'student') {
      if (!data.grade_level) {
        throw new HttpException(
          'Grade level is required for students',
          HttpStatus.BAD_REQUEST,
        );
      }

      switch (true) {
        case !!data.highest_education_level:
          throw new HttpException(
            'you do do not have permission to update this field',
            HttpStatus.BAD_REQUEST,
          );
        case !!data.teching_experience:
          throw new HttpException(
            'you do do not have permission to update this field',
            HttpStatus.BAD_REQUEST,
          );
        case !!data.general_availability:
          throw new HttpException(
            'you do do not have permission to update this field',
            HttpStatus.BAD_REQUEST,
          );
        case !!data.subjects_taught:
          throw new HttpException(
            'you do do not have permission to update this field',
            HttpStatus.BAD_REQUEST,
          );
        case !!data.hourly_rate:
          throw new HttpException(
            'you do do not have permission to update this field',
            HttpStatus.BAD_REQUEST,
          );
        default:
          break;
      }
    }

    if (data.type === 'teacher') {
      if (data.grade_level) {
        throw new HttpException(
          'Grade level is only required for students not for teachers',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!data.highest_education_level) {
        throw new HttpException(
          'Highest education level is required for teachers',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!data.teching_experience) {
        throw new HttpException(
          'Teaching experience is required for teachers',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!data.subjects_taught || data.subjects_taught.length === 0) {
        throw new HttpException(
          'At least one subject is required for teachers',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (data.hourly_rate === undefined || data.hourly_rate <= 0) {
        throw new HttpException(
          'Hourly rate is required and must be greater than 0 for teachers',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (data.is_agreed_terms !== true) {
        throw new HttpException(
          'You must agree to the terms to register as a teacher',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (data.is_agree_application_process !== true) {
        throw new HttpException(
          'You must agree to the application process to register as a teacher',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    const userEmailExist = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (userEmailExist) {
      throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
    }

    const user = await this.prisma.user.create({ data: userData });

    // Creating Stripe customer account
    try {
      const stripeCustomer = await StripePayment.createCustomer({
        user_id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
      });

      if (stripeCustomer) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { billing_id: stripeCustomer.id },
        });
      }
    } catch (error) {
      console.error('Failed to create Stripe customer:', error);
    }

    try {
      const token = await UcodeRepository.createVerificationToken({
        userId: user.id,
        email: user.email,
      });

      await this.mailService.sendVerificationLink({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        token: token.token,
        type: user.type,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
    }

    return user;
  }
  async login({ email, password }) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user)
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);

    const payload = { email: user.email, sub: user.id, type: user.type };
    console.log('Payload:', payload.type);

    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.redis.set(
      `refresh_token:${user.id}`,
      refreshToken,
      'EX',
      60 * 60 * 24 * 7, // 7 days
    );

    return {
      message: 'Logged in successfully',
      authorization: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    };
  }
  async me(userId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          address: true,
          phone_number: true,
          type: true,
          gender: true,
          date_of_birth: true,
          created_at: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.avatar) {
        user['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      if (user) {
        return {
          success: true,
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async updateUser(
    userId: string,
    type: string,
    updateUserDto: UpdateUserDto,
    image?: Express.Multer.File,
  ) {
    try {
      const data: any = {};

      switch (true) {
        case !!updateUserDto.first_name:
          data.first_name = updateUserDto.first_name;
          break;
        case !!updateUserDto.last_name:
          data.last_name = updateUserDto.last_name;
          break;
        case !!updateUserDto.phone_number:
          data.phone_number = updateUserDto.phone_number;
          break;
        case !!updateUserDto.country:
          data.country = updateUserDto.country;
          break;
        case !!updateUserDto.state:
          data.state = updateUserDto.state;
          break;
        case !!updateUserDto.local_government:
          data.local_government = updateUserDto.local_government;
          break;
        case !!updateUserDto.city:
          data.city = updateUserDto.city;
          break;
        case !!updateUserDto.zip_code:
          data.zip_code = updateUserDto.zip_code;
          break;
        case !!updateUserDto.address:
          data.address = updateUserDto.address;
          break;
        case !!updateUserDto.gender:
          data.gender = updateUserDto.gender;
          break;
        case !!updateUserDto.date_of_birth:
          data.date_of_birth = DateHelper.format(updateUserDto.date_of_birth);
          break;
        default:
          break;
      }

      if (type === 'student') {
        if (updateUserDto.grade_level) {
          data.grade_level = updateUserDto.grade_level;
        }

        switch (true) {
          case !!updateUserDto.subjects_taught:
            throw new Error('This is only for teachers');
          case !!updateUserDto.highest_education_level:
            throw new Error('This is only for teachers');
          case !!updateUserDto.teaching_experience:
            throw new Error('This is only for teachers');
          case !!updateUserDto.hourly_rate:
            throw new Error('This is only for teachers');
          default:
            break;
        }
      }
      if (type === 'teacher') {
        if (updateUserDto.grade_level) {
          throw new Error(
            'only students can update this field',
          );
        }

        if (updateUserDto.highest_education_level) {
          data.highest_education_level = updateUserDto.highest_education_level;
        }
        if (updateUserDto.teaching_experience) {
          data.teaching_experience = updateUserDto.teaching_experience;
        }
        if (updateUserDto.subjects_taught) {
          data.subjects_taught = updateUserDto.subjects_taught;
        }
        if (updateUserDto.hourly_rate) {
          data.hourly_rate = updateUserDto.hourly_rate;
        }
      }

      if (image) {
        const oldImage = await this.prisma.user.findFirst({
          where: { id: userId },
          select: { avatar: true },
        });
        if (oldImage.avatar) {
          await SojebStorage.delete(
            appConfig().storageUrl.avatar + oldImage.avatar,
          );
        }

        const fileName = `${StringHelper.randomString()}${image?.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.avatar + fileName,
          image?.buffer,
        );

        data.avatar = fileName;   
        const fullImageUrl = `https://localhost:4010/${appConfig().storageUrl.avatar}${fileName}`;
          console.log('Image URL:', fullImageUrl);
      }

      

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            ...data,
          },
        });

        return {
          success: true,
          message: 'User updated successfully',

        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,

      };
    }
  }
  async validateUser(
    email: string,
    pass: string,
    token?: string,
  ): Promise<any> {
    const _password = pass;
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (user) {
      const _isValidPassword = await UserRepository.validatePassword({
        email: email,
        password: _password,
      });
      if (_isValidPassword) {
        const { password, ...result } = user;
        if (user.is_two_factor_enabled) {
          if (token) {
            const isValid = await UserRepository.verify2FA(user.id, token);
            if (!isValid) {
              throw new UnauthorizedException('Invalid token');
              // return {
              //   success: false,
              //   message: 'Invalid token',
              // };
            }
          } else {
            throw new UnauthorizedException('Token is required');
            // return {
            //   success: false,
            //   message: 'Token is required',
            // };
          }
        }
        return result;
      } else {
        throw new UnauthorizedException('Password not matched');
        // return {
        //   success: false,
        //   message: 'Password not matched',
        // };
      }
    } else {
      throw new UnauthorizedException('Email not found');
      // return {
      //   success: false,
      //   message: 'Email not found',
      // };
    }
  }
  async refreshToken(user_id: string, refreshToken: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);

      if (!storedToken || storedToken != refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required',
        };
      }

      if (!user_id) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const userDetails = await UserRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const payload = { email: userDetails.email, sub: userDetails.id };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

      return {
        success: true,
        authorization: {
          type: 'bearer',
          access_token: accessToken,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async revokeRefreshToken(user_id: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);
      if (!storedToken) {
        return {
          success: false,
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        message: 'Refresh token revoked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async register({
    name,
    first_name,
    last_name,
    email,
    password,
    type,
  }: {
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    type?: string;
  }) {
    try {
      // Check if email already exist
      const userEmailExist = await UserRepository.exist({
        field: 'email',
        value: String(email),
      });

      if (userEmailExist) {
        return {
          statusCode: 401,
          message: 'Email already exist',
        };
      }

      const user = await UserRepository.createUser({
        name: name,
        first_name: first_name,
        last_name: last_name,
        email: email,
        password: password,
        type: type,
      });

      if (user == null && user.success == false) {
        return {
          success: false,
          message: 'Failed to create account',
        };
      }

      // create stripe customer account
      const stripeCustomer = await StripePayment.createCustomer({
        user_id: user.data.id,
        email: email,
        name: name,
      });

      if (stripeCustomer) {
        await this.prisma.user.update({
          where: {
            id: user.data.id,
          },
          data: {
            billing_id: stripeCustomer.id,
          },
        });
      }

      // ----------------------------------------------------
      // // create otp code
      // const token = await UcodeRepository.createToken({
      //   userId: user.data.id,
      //   isOtp: true,
      // });

      // // send otp code to email
      // await this.mailService.sendOtpCodeToEmail({
      //   email: email,
      //   name: name,
      //   otp: token,
      // });

      // return {
      //   success: true,
      //   message: 'We have sent an OTP code to your email',
      // };

      // ----------------------------------------------------

      // Generate verification token
      const token = await UcodeRepository.createVerificationToken({
        userId: user.data.id,
        email: email,
      });

      // Send verification email with token
      await this.mailService.sendVerificationLink({
        email,
        name: email,
        token: token.token,
        type: type,
      });

      return {
        success: true,
        message: 'We have sent a verification link to your email',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async forgotPassword(email) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async resetPassword({ email, token, password }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await UserRepository.changePassword({
            email: email,
            password: password,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: email,
            token: token,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async verifyEmail({ email, token }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await this.prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              email_verified_at: new Date(Date.now()),
            },
          });

          // delete otp code
          // await UcodeRepository.deleteToken({
          //   email: email,
          //   token: token,
          // });

          return {
            success: true,
            message: 'Email verified successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async resendVerificationEmail(email: string) {
    try {
      const user = await UserRepository.getUserByEmail(email);

      if (user) {
        // create otp code
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        // send otp code to email
        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent a verification code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async changePassword({ user_id, oldPassword, newPassword }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const _isValidPassword = await UserRepository.validatePassword({
          email: user.email,
          password: oldPassword,
        });
        if (_isValidPassword) {
          await UserRepository.changePassword({
            email: user.email,
            password: newPassword,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid password',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async requestEmailChange(user_id: string, email: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
          email: email,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: email,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }


  //need to fix
  async changeEmail({
    user_id,
    new_email,
    token,
  }: {
    user_id: string;
    new_email: string;
    token: string;
  }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: new_email,
          token: token,
          forEmailChange: true,
        });

        if (existToken) {
          await UserRepository.changeEmail({
            user_id: user.id,
            new_email: new_email,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: new_email,
            token: token,
          });

          return {
            success: true,
            message: 'Email updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }


  // --------- 2FA ---------
  async generate2FASecret(user_id: string) {
    try {
      return await UserRepository.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async verify2FA(user_id: string, token: string) {
    try {
      const isValid = await UserRepository.verify2FA(user_id, token);
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid token',
        };
      }
      return {
        success: true,
        message: '2FA verified successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async enable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.enable2FA(user_id);
        return {
          success: true,
          message: '2FA enabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  async disable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.disable2FA(user_id);
        return {
          success: true,
          message: '2FA disabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }


  // --------- end 2FA ---------

    // google log in using passport.js
    async googleLogin({ email, userId }: { email: string; userId: string }) {
      try {
        const payload = { email: email, sub: userId };

        const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
        const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

        const user = await UserRepository.getUserDetails(userId);

        await this.redis.set(
          `refresh_token:${user.id}`,
          refreshToken,
          'EX',
          60 * 60 * 24 * 7, // 7 days expiration
        );

        // Return response with tokens
        return {
          // success: true,
          message: 'Logged in successfully',
          authorization: {
            type: 'bearer',
            access_token: accessToken,
            refresh_token: refreshToken,
          },
          type: user.type,
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
        };
      }
    }



    // linkedin log in using passport.js
    async authenticateLinkedInUser({ email, userId }: { email: string; userId: string }) {
      try {
      
        const payload = { email: email, sub: userId }; 
        
        const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
        const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      
        const user = await UserRepository.getUserDetails(userId);


        await this.redis.set(
          `refresh_token:${user.id}`,
          refreshToken,
          'EX',
          60 * 60 * 24 * 7, // 7 days expiration
        );

        // Return response with JWT tokens
        return {
          success: true, 
          message: 'Logged in successfully via LinkedIn',
          authorization: {
            type: 'bearer',
            access_token: accessToken,
            refresh_token: refreshToken,
          },
          type: user.type,  
        };
      } catch (error) {
        return {
          success: false,
          message: error.message, 
        };
      }
    }

 
}
