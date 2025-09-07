import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session-teacher.dto';
import { count } from 'console';

@Injectable()
export class TeacherService {

  constructor(
    private readonly prismaService: PrismaService,
  ) { }


  // session creating
  // async create(createSessionDto: CreateSessionDto) {

  //   const session = await this.prismaService.create_Session.create({
  //     data: {
  //       user_id: createSessionDto.user_id,
  //       session_type: createSessionDto.session_type,
  //       subject: createSessionDto.subject,
  //       session_charge: createSessionDto.session_charge,
  //       mode: createSessionDto.mode,
  //       slots_available: (createSessionDto.slots_available) || null,
  //       join_link: createSessionDto.join_link,
  //       available_slots_time_and_date: {
  //         set: createSessionDto.available_slots_time_and_date,
  //       },
  //     },
  //   });

  //   return {
  //     message: 'Session successfully created',
  //     session_type: session.session_type,
  //     subject: session.subject,
  //     user_id: session.user_id,
  //   };
  // }

  async create(createSessionDto: CreateSessionDto) {
  const userExists = await this.prismaService.user.findUnique({
    where: { id: createSessionDto.user_id }, 
  });

  if (!userExists) {
    return {
      message: 'User not found. Cannot create session.',
    }
  }

  if (!Array.isArray(createSessionDto.available_slots_time_and_date) || createSessionDto.available_slots_time_and_date.length === 0) {
    return {
      message: 'Available slots time and date must be a non-empty array.',
    }
  }

  try {
    const session = await this.prismaService.create_Session.create({
      data: {
        user_id: createSessionDto.user_id,
        session_type: createSessionDto.session_type,
        subject: createSessionDto.subject,
        session_charge: createSessionDto.session_charge,
        mode: createSessionDto.mode,
        slots_available: createSessionDto.slots_available || null, 
        join_link: createSessionDto.join_link,
        available_slots_time_and_date: {
          set: createSessionDto.available_slots_time_and_date,
        },
      },
    });

    return {
      message: 'Session successfully created',
      session_type: session.session_type,
      subject: session.subject,
      user_id: session.user_id,
    };
  } catch (error) {
    console.error('Error creating session:', error);
  }
}


  // async findAll() {
  //   return this.prismaService.create_Session.findMany();
  // }

  async findAll() {
  const sessions = await this.prismaService.create_Session.findMany({
    include: {
      user: true,  
    },
  });

  const teacherData = {};

  sessions.forEach((session) => {
    const user = session.user;

    if (!teacherData[user.id]) {
      teacherData[user.id] = {
        avatar: user.avatar || 'default-avatar.jpg',
        name: `${user.first_name} ${user.last_name}`,
        bio: user.about_me,
        country: user.country,
        city: user.city,
        pricing: 'Pricing not available',
        subjects: new Set(),
      };
    }

    teacherData[user.id].subjects.add(session.subject);
  });

  const teacherProfiles = Object.values(teacherData).map((teacherObj: any) => ({
    ...{
      avatar: teacherObj.avatar,
      name: teacherObj.name,
      bio: teacherObj.bio,
      location: teacherObj.location,
      pricing: teacherObj.pricing,
    },
    subjects: Array.from(teacherObj.subjects),
  }));

  return teacherProfiles;
}



  //getting one session by id
  async findOne(id: string) {
    const session = await this.prismaService.create_Session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }
  async update(id: string, updateSessionDto: UpdateTeacherDto, userId: string): Promise<any> {

    const session = await this.prismaService.create_Session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.user_id !== userId) {
      throw new ForbiddenException('You are not allowed to update this session');
    }


    const updatedSession = await this.prismaService.create_Session.update({
      where: { id },
      data: updateSessionDto,
    });

    return {
      message: 'Session updated successfully',
      session_type: updatedSession.session_type,
      subject: updatedSession.subject,
      user_id: updatedSession.user_id,
    };

  }
  //delete session by id
  async remove(id: string, userId: string): Promise<any> {

    const session = await this.prismaService.create_Session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.user_id !== userId) {
      throw new ForbiddenException('You are not allowed to delete this session');
    }

    await this.prismaService.create_Session.delete({
      where: { id },
    });
    return { message: 'Session deleted successfully' };
  }

}
