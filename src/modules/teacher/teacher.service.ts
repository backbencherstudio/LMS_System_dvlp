import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session-teacher.dto';
import { count } from 'console';
import { Mode } from '@prisma/client';
import { DateHelper } from 'src/common/helper/date.helper';
import { acceptReqDto } from './dto/accept-req.dto';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

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
      select: {
        id: true,
        user_id: true,
        subject: true,
        session_charge: true,
        mode: true,
        slots_available: true,
        available_slots_time_and_date: true,
        join_link: true,
        session_type: true,

      }
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
            user_id: true,
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
        userid: Create_Session.length > 0 ? Create_Session[0]?.user_id : null, // Updated line
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
    const myData = await this.prismaService.book_Session.findMany({
      where: { is_completed: 1, create_session: { user_id: userId } },
    });

    return {
      success: true,
      data: myData,
    };
  }
  async getallRequestsForReschedule(userId: string) {
    const checkTeacher = await this.prismaService.user.findUnique({
      where: { id: userId, type: 'teacher' },
    });

    const allreqForATeacher = await this.prismaService.reschedule_Session.findMany({
      where: {
        book_session: {
          create_session: {
            user_id: userId
          }
        }
      }
    });

    if (!checkTeacher) {
      throw new NotFoundException('Teacher not found or user is not a teacher');
    }
    else {
      return allreqForATeacher;
    }



  }
  async handleRequest(
    requestId: string,
    userId: string,
    action: string,
    acceptDto: acceptReqDto,
  ) {
    const request = await this.prismaService.reschedule_Session.findUnique({
      where: { id: requestId },
      select: {
        book_session: {
          where: {
            create_session: { user_id: userId },
          },
        },
        is_accepted: true,
        is_rejected: true,
      }
    });

    if (!request) {
      return { message: 'Reschedule request not found' };
    }
    if (request.is_accepted === 1) {
      return { message: 'This request has already been accepted, you cannot reject this' };
    }
    if (request.is_rejected === 1) {
      return { message: 'This request has already been rejected, you cannot accept this' };
    }

    //using ternary operator
    //   request.is_accepted === 1 ?
    // { message: 'This request has already been accepted' } :
    // request.is_rejected === 1 ?
    //   { message: 'This request has already been rejected' } : null;

    const bookSession = request.book_session;
    if (!bookSession) {
      return { message: 'Associated book session not found' };
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.type !== 'teacher') {
      return {
        message: 'Only users with TEACHER role can process reschedule requests.',
      };
    }

    if (action === 'accept') {
      // Logic to accept the request
      if (!acceptDto.rescheduled_date) {
        return { message: 'You must provide a rescheduled date' };
      }

      await this.prismaService.reschedule_Session.update({
        where: { id: requestId },
        data: {
          is_accepted: 1,
          is_rejected: 0,
          rescheduled_date: acceptDto.rescheduled_date,
          reject_reason: null,
        },
      });

      return { message: 'Reschedule request accepted successfully' };
    }

    if (action === 'reject' && request.is_accepted === 0) {
      // Logic to reject the request
      if (!acceptDto.reject_reason.trim()) {
        return { message: 'Reject reason cannot be empty' };
      }

      await this.prismaService.reschedule_Session.update({
        where: { id: requestId },
        data: {
          is_accepted: 0,
          is_rejected: 1,
          reject_reason: acceptDto.reject_reason,
          rescheduled_date: null,
        },
      });

      return { message: 'Reschedule request rejected successfully' };
    }

    return { message: 'Invalid action' };
  }
  //get all booked sessions for a teacher
  async getAllBookedSessionsForOneTeacher(userId: string) {
    const all = this.prismaService.book_Session.findMany({
      where: { create_session: { user_id: userId } },
      select: {
        create_session: {
          select: {
            id: true,
            user_id: true,
            subject: true,
            session_type: true,
          }
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            type: true,
            avatar: true,
          }
        },
      },
    });

    const formattedResults = (await all).map(booking => {
      const teacherID = `${booking.create_session.user_id}`;


      const sessionId = booking.create_session.id;
      const subject = booking.create_session.subject;
      const sessionType = booking.create_session.session_type;

      const studentId = booking.user?.id || null;
      const studentName = booking.user ? `${booking.user.first_name} ${booking.user.last_name}` : 'N/A';
      const studentType = booking.user?.type || 'N/A';

      return {
        teacher: {
          teacherId: teacherID,
        },
        session: {
          sessionId: sessionId,
          subject: subject,
          sessionType: sessionType,
        },
        student: {
          studentId: studentId,
          studentName: studentName,
          studentType: studentType,
        }
      };
    });

    return formattedResults;
  }
  //get all teachers
  async getAllTeachers() {
    return this.prismaService.user.findMany({
      where: { type: 'teacher' },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        avatar: true,
        country: true,
        city: true,
        about_me: true,
        created_at: true,
      },
    });
  }
  async getATeacherById(teacherId: string) {
    const teacher = await this.prismaService.user.findFirst({
      where: {
        id: teacherId,
        type: 'teacher',
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        avatar: true,
        country: true,
        city: true,
        about_me: true,
        created_at: true,
        certifications: true,
      },
    });

    if (!teacher) {
      return {
        success: false,
        message: 'Teacher not found or user is not a teacher',
        data: null,
      };
    }


    const basePublicUrl = `http://localhost:4012/public/storage/`;

    if (teacher.avatar) {
      teacher['avatar_url'] = `${basePublicUrl}avatar/${teacher.avatar}`;
    }

    if (Array.isArray(teacher.certifications) && teacher.certifications.length > 0) {
      teacher['certifications_urls'] = teacher.certifications.map(cert =>
        `${basePublicUrl}certificate/${cert}`
      );
    }

    return {
      success: true,
      message: 'Teacher fetched successfully',
      data: teacher,
    };
  }


}
