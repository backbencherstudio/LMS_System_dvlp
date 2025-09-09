import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session-teacher.dto';
import { count } from 'console';
import { Mode } from '@prisma/client';
import { DateHelper } from 'src/common/helper/date.helper';

@Injectable()
export class TeacherService {

  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  // session creating
  async create(createSessionDto: CreateSessionDto) {
    const userExists = await this.prismaService.user.findUnique({
      where: { id: createSessionDto.user_id },
      select: { type: true },
    });

    if (!userExists) {
      return {
        message: 'User not found. Cannot create session.',
      };
    }

    if (userExists.type !== 'teacher') {
      return {
        message: 'Only users with TEACHER role can create sessions.',
      };
    }

    if (
      !Array.isArray(createSessionDto.available_slots_time_and_date) ||
      createSessionDto.available_slots_time_and_date.length === 0
    ) {
      return {
        message: 'Available slots time and date must be a non-empty array.',
      };
    }

    const currentDateUTC = new Date(Date.now());

    const hasPastSlot = createSessionDto.available_slots_time_and_date.some((slot) => {
      const slotDate = new Date(slot);
      return slotDate < currentDateUTC;
    });

    if (hasPastSlot) {
      return {
        message: 'You cannot set past dates or times for available slots.',
      };
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
  //get all sessions for one teacher
  async getAllSessionsForOneTeacher(userId: string) {
    return this.prismaService.create_Session.findMany({
      where: { user_id: userId },
    });
  }
  //getting all sessions
  async findAll() {
    const sessions = await this.prismaService.create_Session.findMany({
      select: {
        id: true,
        user_id: true,
        session_charge: true,
      },
    });

    const charges = sessions
      .map(({ session_charge }) => Number(session_charge))
      .filter(charge => !isNaN(charge) && charge !== null);

    if (charges.length === 0) {
      return {
        id: null,
        name: null,
        priceRange: 'N/A',
      };
    }

    const min = Math.min(...charges);
    let max = Math.max(...charges);

    if (min === max) {
      max = min + 20;
    }

    const validUserIds = sessions
      .map(({ user_id }) => user_id)
      .filter((id): id is string => id !== null);

    const teacherIds = await this.prismaService.user.findMany({
      where: { id: { in: validUserIds } },
      select: {
        first_name: true,
        last_name: true,
        about_me: true,
        country: true,
        avatar: true,
        city: true,
        Create_Session: {
          select: {
            subject: true,
            session_charge: true,
            mode: true,
            available_slots_time_and_date: true,
          },
        },
      },
    });

    if (teacherIds.length === 0) {
      return {
        teacherIds: null,
        priceRange: `${min} - ${max}`,
      };
    }

    const modes = [
      ...new Set(teacherIds.flatMap(({ Create_Session }) =>
        Create_Session.map(({ mode }) => mode)
      )),
    ];



    const nextAvailability = teacherIds
      .flatMap(({ Create_Session }) =>
        Create_Session.flatMap(({ available_slots_time_and_date }) => available_slots_time_and_date)
      )
      .sort((a, b) => a.getTime() - b.getTime());

    if (nextAvailability.length > 0 && nextAvailability[0].toDateString() === DateHelper.now().toDateString()) {
      nextAvailability[0] = 'Today' as any;
    }

    return {
      teacherIds: teacherIds.map(({ first_name, last_name, avatar, about_me, country, city, Create_Session }) => ({
        username: `${first_name} ${last_name}`,
        avatar,
        about_me,
        country,
        city,
        subjects: Create_Session.map(({ subject }) => subject),
        modes,
        priceRange: `${min} - ${max}`,
        nextAvailability: nextAvailability.length > 0 ? nextAvailability[0] : null,
        grades: '6-12',
      })),
    };
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

    let isteacher = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { type: true }
    });

    if (isteacher.type !== 'teacher') {
      throw new ForbiddenException('Only users with TEACHER role can update sessions');
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
  async getallEndedSessionsForOneTeacher(userId: string) {
    return this.prismaService.book_Session.findMany({
      where: { is_completed: 1 },
      select: {
        create_session: {
          where: { user_id: userId }
        }
      }
    });
  }

  async getallRequestsForReschedule(userId: string) {
    const checkTeacher = await this.prismaService.user.findUnique({
      where: { id: userId, type: 'teacher' },
    });

    if (!checkTeacher) {
      throw new NotFoundException('Teacher not found or user is not a teacher');
    }
    else {
      return this.prismaService.reschedule_Session.findMany({

      });
    }



  }
  //accept a reschedule request
  //decline a reschedule request

}
