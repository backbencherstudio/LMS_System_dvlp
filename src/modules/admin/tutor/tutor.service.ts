import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTutorDto } from './dto/create-tutor.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Restriction_period } from '@prisma/client';
import { RestrictUserDto } from './dto/restrict-user.dto';

@Injectable()
export class TutorService {

  constructor(private readonly prismaService: PrismaService) {}
  
  create(createTutorDto: CreateTutorDto) {
    return 'This action adds a new tutor';
  }

   async findAll(type: string) {

    if(type !== 'admin'){
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

  // restricted access
   // Restrict a user
  async restrictUser(userId: string, restrictUserDto: RestrictUserDto) {

    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    return this.prismaService.user.update({
      where: { id: userId },
      data: {
        is_restricted: 1,
        restriction_reason: restrictUserDto.reason,
        restriction_period: restrictUserDto.period,
      },
    });
  }

  // Unrestrict a user
  async unrestrictUser(userId: string) {
    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    return this.prismaService.user.update({
      where: { id: userId },
      data: {
        is_restricted: 0,
        restriction_reason: null,
        restriction_period: null,
      },
    });
  }

   // Get all restricted users
  async getRestrictedUsers() {
    return this.prismaService.user.findMany({
      where: { is_restricted: 1 },
      select: {
        id: true,
        name: true,
        email: true,
        restriction_reason: true,
        restriction_period: true,
      },
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} tutor`;
  }

  update(id: number, updateTutorDto: UpdateTutorDto) {
    return `This action updates a #${id} tutor`;
  }

  remove(id: number) {
    return `This action removes a #${id} tutor`;
  }
}
