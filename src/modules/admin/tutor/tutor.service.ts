import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTutorDto } from './dto/create-tutor.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Restriction_period } from '@prisma/client';
import { RestrictUserDto } from './dto/restrict-user.dto';
import { MailService } from 'src/mail/mail.service';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';
@Injectable()
export class TutorService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
    private readonly messageGateway: MessageGateway,
  ) {}

  async getAllTutors(type: string) {
    if (type !== 'admin') {
      return {
        success: false,
        message: 'You are not authorized to access this resource',
      };
    }

    const sessions = await this.prismaService.create_Session.findMany({
      select: {
        id: true,
        user_id: true,
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
    //  SESSION_ID: s.id,
      User_Id: s.user_id,
      NAME: s.user?.name,
      SUBJECT: s.subject,
      HOURLY_RATE: s.user?.hourly_rate,
      STATUS:
        s.user?.status === 1
          ? 'Active'
          : s.user?.status === 0
            ? 'Inactive'
            : 'Restricted',
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
        type: true,
      },
    });

    return {
      success: true,
      data: restrictedUsers,
    };
  }

  //get all tutor applications
  async getAllTutorApplications() {
    try {
      const applications = await this.prismaService.user.findMany({
        where: { type: 'teacher', is_accepted: 'pending' },
        select: {
          id: true,
          type: true,
          name: true,
          email: true,
          hourly_rate: true,
          subjects_taught: true,
          is_accepted: true,
          country: true,
          city: true,
          certifications: true,
        },
      });

      return {
        success: true,
        data: applications,
      };
    } catch (error) {
      console.log(error);
    }
  }

  async getOneTutorApplication(id: string) {
    try {
      const applicat_owner = await this.prismaService.user.findUnique({
        where: { id: id, type: 'teacher' },
        select: {
          id: true,
          name: true,
          email: true,
          is_accepted: true,
          status: true,
          type: true,
          certifications: true,
          country: true,
          hourly_rate: true,
          teching_experience: true,
          city: true,
        },
      });
      const basePublicUrl = `http://localhost:${process.env.PORT || 5000}/public/storage/`;
      if (applicat_owner.type === 'teacher') {
        if (
          Array.isArray(applicat_owner.certifications) &&
          applicat_owner.certifications.length > 0
        ) {
          applicat_owner['certifications_urls'] =
            applicat_owner.certifications.map(
              (cert) => `${basePublicUrl}certificate/${cert}`,
            );
        }
      }

      delete applicat_owner.certifications;
      return {
        success: true,
        data: applicat_owner,
      };
    } catch (error) {
      console.log(error);
      return {
        success: false,
        message: 'Error fetching tutor application',
        error: error.message,
      };
    }
  }

  async acceptTutorApplication(id: string) {
    try {
      const tutor = await this.prismaService.user.findUnique({
        where: { id: id },
        select: { id: true, type: true, email: true, name: true },
      });
      if (tutor?.type !== 'teacher') {
        return {
          success: false,
          message: 'User is not a tutor',
        };
      }

      await this.prismaService.user.update({
        where: { id: id },
        data: { is_accepted: 'accepted' },
      });

      // notification
      const appceptTeacherNotificationPlaload: any = {
        sender_id: '',
        receiver_id: tutor.id,
        text: 'Your tutor application has been accepted.',
        type: 'teacher_application_accepted',
      };
      NotificationRepository.createNotification(
        appceptTeacherNotificationPlaload,
      );

      this.messageGateway.server.emit(
        'notification',
        appceptTeacherNotificationPlaload,
      );

      // mail
      await this.mailService.sendTutorApplicationStatusEmail({
        email: tutor.email,
        name: tutor.name,
        status: 'accepted',
      });
      return {
        success: true,
        message: 'Tutor application accepted',
      };
    } catch (error) {}
  }
  async rejectTutorApplication(id: string) {
    try {
      const tutor = await this.prismaService.user.findUnique({
        where: { id: id },
        select: { id: true, type: true, email: true, name: true },
      });
      if (tutor?.type !== 'teacher') {
        return {
          success: false,
          message: 'User is not a tutor',
        };
      }
      await this.prismaService.user.update({
        where: { id: id },
        data: { is_accepted: 'rejected' },
      });

      // notification
      const appceptTeacherNotificationPlaload: any = {
        sender_id: '',
        receiver_id: tutor.id,
        text: 'Your tutor application has been rejected.',
        type: 'teacher_application_accepted',
      };
      NotificationRepository.createNotification(
        appceptTeacherNotificationPlaload,
      );

      this.messageGateway.server.emit(
        'notification',
        appceptTeacherNotificationPlaload,
      );
      // mail
      await this.mailService.sendTutorApplicationStatusEmail({
        email: tutor.email,
        name: tutor.name,
        status: 'rejected',
      });

      return {
        success: true,
        status: 400,
        message: 'Tutor application rejected',
      };
    } catch (error) {
      console.log(error);
      return {
        success: false,
        message: 'An error occurred while rejecting the tutor application.',
      };
    }
  }
  //get all accepted tutors
  async getAllAcceptedTutors() {
    try {
      const actecpteTutors = await this.prismaService.user.findMany({
        where: { type: 'teacher', is_accepted: 'accepted' },
        select: { id: true, email: true, name: true },
      });

      return {
        success: true,
        data: actecpteTutors,
      };
    } catch (error) {}
  }
}
