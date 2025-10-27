import { Injectable } from '@nestjs/common';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) {}

  async getAllSessions() {
    try {
      const defaultDuration = '60min';

      const sessions = await this.prisma.create_Session.findMany({
        select: {
          id: true,
          subject: true,
          status: true,
          session_charge: true,
          available_slots_time_and_date: true,
          user: {
            select: {
              name: true,
            },
          },
          Book_Session: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      const sessionsWithDuration = sessions.map((session) => ({
        id: session.id,
        subject: session.subject,
        status: session.status,
        session_charge: session.session_charge,
        available_slots_time_and_date: session.available_slots_time_and_date,
        tutor_name: session.user ? session.user.name : 'Unknown',
        duration: defaultDuration,
        Book_Session: session.Book_Session.map((booking) => ({
          name: booking.user ? booking.user.name : 'Unknown',
        })),
      }));

      return {
        success: true,
        message: 'Sessions fetched successfully.',
        data: sessionsWithDuration,
      };
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return {
        statusCode: 500,
        success: false,
        message: 'An error occurred while fetching sessions.',
        error: error.message,
      };
    }
  }
  async restrictAsession(id: string, reason: string) {
    try {
      const session = await this.prisma.create_Session.findUnique({
        where: { id },
      });

      if (!session) {
        return {
          success: false,
          message: 'Session not found.',
        };
      }
      if (session.is_restricted == 1) {
        return {
          success: false,
          message: 'Already restricted.',
        };
      }

      await this.prisma.create_Session.update({
        where: { id },
        data: {
          is_restricted: 1,
          restriction_reason: reason,
        },
      });

      // restrict session notification
      const teacherSessionNotificationPayload: any = {
        sender_id: '',
        receiver_id: session.user_id,
        text: `Your session with Subject Name: ${session.subject} has been restricted. Reason: ${reason}`,
        type: 'session_restriction',
      };

      NotificationRepository.createNotification(
        teacherSessionNotificationPayload,
      );

      this.messageGateway.server.emit(
        'notification',
        teacherSessionNotificationPayload,
      );

      return {
        success: true,
        message: 'Session restricted successfully.',
      };
    } catch (error) {
      console.error('Error restricting session:', error);
      return {
        statusCode: 500,
        success: false,
        message: 'An error occurred while restricting the session.',
        error: error.message,
      };
    }
  }
  async unRestrictAsession(id: string) {
    try {
      const session = await this.prisma.create_Session.findUnique({
        where: { id },
      });
      if (!session) {
        return {
          success: false,
          message: 'Session not found.',
        };
      }
      if (session.is_restricted == 0) {
        return {
          success: false,
          message: 'Session is not restricted.',
        };
      }

      await this.prisma.create_Session.update({
        where: { id },
        data: {
          is_restricted: 0,
          restriction_reason: null,
        },
      });
      // unrestrict session notification
      const adminNotificationPayload: any = {
        sender_id: '',
        receiver_id: session.user_id,
        text: `Your session with Subject Name: ${session.subject} has been unrestricted.`,
        type: 'session_unrestriction',
      };

      NotificationRepository.createNotification(adminNotificationPayload);

      this.messageGateway.server.emit('notification', adminNotificationPayload);

      return {
        success: true,
        message: 'Session unrestricted successfully.',
      };
    } catch (error) {
      console.error('Error unrestricting session:', error);
      return {
        statusCode: 500,
        success: false,
        message: 'An error occurred while unrestricting the session.',
        error: error.message,
      };
    }
  }
}
