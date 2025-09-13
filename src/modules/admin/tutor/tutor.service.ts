import { Injectable } from '@nestjs/common';
import { CreateTutorDto } from './dto/create-tutor.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TutorService {

  constructor(private prismaService: PrismaService) {}

  create(createTutorDto: CreateTutorDto) {
    return 'This action adds a new tutor';
  }
  
  // Find all tutors with specific fields
  async findAll() {
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
