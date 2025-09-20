import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';

import { MailService } from 'src/mail/mail.service';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Prisma } from '@prisma/client';
import { ReqDto } from './dto/req.dto';
import { Body } from '@nestjs/common';
import { StudentRatingDto } from './dto/student-rating.dto';
import { Role } from '../../common/guard/role/role.enum';

@Injectable()
export class StudentsService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) { }

  create(createStudentDto: CreateStudentDto) {
    return 'This action adds a new student';
  }
  async bookASession(
    sessionId: string,
    userId: string,
    createStudentDto: CreateStudentDto,
  ) {
    const slotDate = createStudentDto.slots;
    if (!slotDate) {
      throw new BadRequestException('Slot date is required');
    }

    const session = await this.prisma.create_Session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (
      session.slots_available !== null &&
      Number(session.slots_available) >= 15
    ) {
      throw new BadRequestException('No slots available for this session');
    }

    const isSlotAvailable = session.available_slots_time_and_date.some(
      (slot) => slot.toISOString() === slotDate.toISOString(),
    );

    if (!isSlotAvailable) {
      return { message: 'Sorry no availbale slots on this time ' };
    }

    const alreadyBooked = await this.prisma.book_Session.findFirst({
      where: {
        create_session_id: sessionId,
        user_id: userId,
        session_date: slotDate,
      },
    });

    if (alreadyBooked) {
      return {
        message: 'You have already booked this session at the selected time',
      };
    }

    const bookedSession = await this.prisma.book_Session.create({
      data: {
        user_id: userId,
        username: createStudentDto.name,
        subject: session.subject,
        create_session_id: sessionId,
        session_date: createStudentDto.slots,
        status: 'pending',
      },
    });

    await this.prisma.create_Session.update({
      where: { id: sessionId },
      data: {
        slots_available: (Number(session.slots_available) - 1).toString(),
      },
    });

    return {
      message: 'Session booked successfully',
      bookedSession,
    };
  }
  async getAllBookedSessionsForStudent(userId: string) {
    const bookings = await this.prisma.book_Session.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        username: true,
        session_date: true || null,
        is_joined: true || null,
        is_cancelled: true || null,
        is_completed: true || null,
        is_request_for_reschedule: true || null,
        status: true || null,
        create_session: {
          select: {
            id: true,
            user_id: true,
            session_type: true,
            subject: true,
            session_charge: true,
            mode: true,
            join_link: true,
          },
        },
        Reschedule_Session: {
          select: {
            id: true,
            subject: true,
            reason: true,
            is_accepted: true,
            is_rejected: true,
            reject_reason: true,
            rescheduled_date: true,
          },
        },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { first_name: true, last_name: true, avatar: true, type: true },
    });
    if (user?.type !== 'student') {
      throw new BadRequestException(
        'Only students can access their booked sessions',
      );
    }

    const teacherName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`;
    const avatar = user?.avatar ?? null;

    const formattedBookings = bookings.map((booking) => {
      return {
        bookingId: booking.id,
        studentUsername: booking.username,
        sessionDate: booking.session_date
          ? new Date(booking.session_date).toISOString()
          : 'N/A',
        isJoined: booking.is_joined === 1 ? true : false,
        isCancelled: booking.is_cancelled === 1 ? true : false,
        isCompleted: booking.is_completed === 1 ? true : false,
        status: booking.status || 'N/A',
        sessionDetails: {
          sessionId: booking.create_session.id,
          teacherId: booking.create_session.user_id,
          teacherName: teacherName.trim() || 'N/A',
          avatar: avatar,
          sessionType: booking.create_session.session_type,
          subject: booking.create_session.subject,
          charge: booking.create_session.session_charge,
          mode: booking.create_session.mode,
          joinLink: booking.create_session.join_link ?? 'N/A',
        },
        rescheduleDetails:
          Array.isArray(booking.Reschedule_Session) &&
            booking.Reschedule_Session.length > 0
            ? {
              requestId: booking.Reschedule_Session[0].id,
              subject: booking.Reschedule_Session[0].subject,
              reason: booking.Reschedule_Session[0].reason,
              isAccepted:
                booking.Reschedule_Session[0].is_accepted === 1
                  ? true
                  : false,
              isRejected:
                booking.Reschedule_Session[0].is_rejected === 1
                  ? true
                  : false,
              rejectReason:
                booking.Reschedule_Session[0].reject_reason || 'N/A',
              rescheduledDate: booking.Reschedule_Session[0].rescheduled_date
                ? new Date(
                  booking.Reschedule_Session[0].rescheduled_date,
                ).toISOString()
                : 'N/A',
            }
            : null,
      };
    });

    return {
      bookings: formattedBookings,
    };
  }
  async getAllCompletedSessionsForStudent(userId: string) {
    const completedSessions = await this.prisma.book_Session.findMany({
      where: {
        user_id: userId,
        is_joined: 1, // The student has joined the session
        is_completed: 1, // The session is marked as completed
      },
      select: {
        id: true,
        username: true,
        session_date: true || null,
        is_completed: true,
        session_period: true || null,
        create_session: {
          // Directly select related create_session details
          select: {
            id: true,
            user_id: true,
            session_type: true,
            subject: true,
            session_charge: true,
            mode: true,
            join_link: true,
          },
        },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { first_name: true, last_name: true, avatar: true },
    });

    const teacherName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`;
    const avatar = user?.avatar ?? null;

    const formattedCompletedSessions = completedSessions.map((session) => {
      const createSession = session.create_session
        ? session.create_session
        : null;

      const sessionDetails = createSession
        ? {
          sessionId: createSession.id,
          teacherName: teacherName.trim() || 'N/A',
          avatar: avatar,
          sessionType: createSession.session_type,
          subject: createSession.subject,
          charge: createSession.session_charge,
          mode: createSession.mode,
          joinLink: createSession.join_link ?? 'N/A',
          sessionPeriod: session.session_period || '60 mins',
        }
        : {};

      return {
        sessionId: session.id,
        studentUsername: session.username,
        sessionDate: session.session_date
          ? new Date(session.session_date).toISOString()
          : 'N/A',
        isCompleted: session.is_completed,
        sessionDetails,
      };
    });

    return {
      completedSessions: formattedCompletedSessions,
    };
  }
  async joinsession(userId: string, sessionId: string) {
    const session = await this.prisma.book_Session.findFirst({
      where: { id: sessionId, user_id: userId },
      select: {
        id: true,
        username: true,
        is_joined: true,
        is_cancelled: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.is_cancelled === 1) {
      return { message: 'Cannot join a cancelled session' };
    }

    if (session.is_joined === 1) {
      return { message: 'Session already joined' };
    } else {
      await this.prisma.book_Session.update({
        where: { id: sessionId },
        data: { is_joined: 1 },
      });
      return { message: 'Session joined successfully' };
    }
  }
  async cancellSession(userId: string, sessionId: string) {
    const session = await this.prisma.book_Session.findFirst({
      where: { id: sessionId, user_id: userId },
      select: {
        id: true,
        username: true,
        is_joined: true,
      },
    });
    if (session?.is_joined === 1) {
      return {
        message: 'You cannot cancel a session that has already been joined',
      };
    }

    if (!session) {
      throw new NotFoundException('Session not found');
    }
    await this.prisma.book_Session.update({
      where: { id: sessionId },
      data: { is_cancelled: 1 },
    });
    return { message: 'Session cancelled successfully' };
  }
  async requestRescheduleSession(
    reqDTo: ReqDto,
    sessionId: string,
    userId: string,
  ) {
    try {
      const req = await this.prisma.book_Session.findFirst({
        where: {
          id: sessionId,
          user_id: userId,
        },
        select: {
          id: true,
          username: true,
          is_joined: true,
          is_cancelled: true,
          session_date: true,
          subject: true,
          create_session_id: true,
          create_session: {
            select: {
              user_id: true,
            },
          },
        },
      });

      if (!req) {
        return { message: 'Session not found' };
      }

      if (req.is_joined === 1) {
        return {
          message:
            'You cannot reschedule a session that has already been joined',
        };
      }

      if (req.is_cancelled === 1) {
        return { message: 'You cannot reschedule a cancelled session' };
      }

      const existingRescheduleRequest =
        await this.prisma.reschedule_Session.findFirst({
          where: {
            user_id: userId,
            book_session_id: sessionId,
          },
        });

      if (existingRescheduleRequest) {
        return {
          message:
            'A reschedule request has already been made for this session',
        };
      }

      const now = new Date();
      const sessionDate = new Date(req.session_date);
      // const sessionEndTime = new Date(sessionDate.getTime() + 60 * 60 * 1000);
      const sessionEndTime = new Date(sessionDate.getTime() + 10 * 1000); // Adds 10 seconds
      if (now < sessionEndTime) {
        return {
          message:
            'Reschedule requests can only be made after the session end time',
        };
      }

      await this.prisma.reschedule_Session.create({
        data: {
          user_id: userId,
          username: reqDTo.name,
          subject: req.subject,
          reason: reqDTo.reason,
          book_session_id: sessionId,
        },
      });

      await this.prisma.book_Session.update({
        where: { id: sessionId },
        data: { is_request_for_reschedule: 1, status: 'Reschedule_requested' },
      });

      return { message: 'Reschedule request sent successfully' };
    } catch (error) {
      console.error('Error in requestRescheduleSession service:', error);
      throw new Error(`Service error: ${error.message || error}`);
    }
  }
  //get all students
  async getAllStudents() {
    const students = await this.prisma.user.findMany({
      where: { type: 'student' },
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
    return { students };
  }
  //get a student by id
  async getAStudentById(id: string) {
    const student = await this.prisma.user.findUnique({
      where: { id, type: 'student' },
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
    if (!student) {
      return { message: 'Student not found' };
    }
    return { student };
  }

  async rateASession(
    body: StudentRatingDto,
    bookSessionID: string,
    userId: string,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { type: true },
      });

      if (!user || user.type !== 'student') {
        return {message:" Unauthorized: Only students can rate sessions "};
      }

      const bookSession = await this.prisma.book_Session.findFirst({
        where: {
          user_id: userId,
          id: bookSessionID,
        },
        select: { id: true, create_session_id: true },
      });

      if (!bookSession) {
        return { message: 'Booking session not found' };
      }

      const existingRating = await this.prisma.rate_Session.findFirst({
        where: {
          user_id: userId,
          book_session_id: bookSession.id,
        },
      });

      if (existingRating) {
        return { message: 'You have already rated this session' };
      }

      const createRateASession = await this.prisma.rate_Session.create({
        data: {
          user_id: userId,
          rating: body.rating,
          book_session_id: bookSession.id,
          comment: body.comment,
          create_session_id: bookSession.create_session_id,
        },
      });

      return { message: 'Session rated successfully', createRateASession };
    } catch (error) {
      console.error('Error in rateASession service:', error);
      throw new Error(`Service error: ${error.message || error}`);
    }
  }



}
