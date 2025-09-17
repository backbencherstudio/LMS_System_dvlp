import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTutorDto } from './dto/create-tutor.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Restriction_period } from '@prisma/client';
import { RestrictUserDto } from './dto/restrict-user.dto';

@Injectable()
export class TutorService {

  constructor(private readonly prismaService: PrismaService) { }

  async getAllTutors(type: string) {

    if (type !== 'admin') {
      return {
        success: false,
        message: "You are not authorized to access this resource"
      }
    }

    const sessions = await this.prismaService.create_Session.findMany({
      select: {
        id: true,
        subject: true,
        user: {
          select: {
            name: true,
            hourly_rate: true,
            status: true,
            city: true,
          },
        },
      },
    });


    const formatted = sessions.map((s) => ({
      SESSION_ID: s.id,
      NAME: s.user?.name,
      SUBJECT: s.subject,
      HOURLY_RATE: s.user?.hourly_rate,
      STATUS: s.user?.status === 1 ? 'Active' : s.user?.status === 0 ? 'Inactive' : 'Restricted',
      LOCATION: s.user?.city,
    }));

    return {
      success: true,
      data: formatted,
    };
  }
  // Get all restricted users
  async getAllRestrictedTeacher(type: string) {
    if (type !== 'admin') {
      return {
        success: false,
        message: 'Unauthorized access',
        data: [],
      };
    }

    const restrictedUsers = await this.prismaService.user.findMany({
      where: {
        is_restricted: 1,
        type: 'teacher',
      },
      select: {
        id: true,
        name: true,
        email: true,
        restriction_reason: true,
        restriction_period: true,
        is_restricted: true,
      },
    });

    return {
      success: true,
      data: restrictedUsers,
    };
  }

}
