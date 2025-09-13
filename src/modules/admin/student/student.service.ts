import { Injectable } from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Restriction_period } from '@prisma/client';

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  async findAll(type: string) {
    if (type !== 'admin') {
      return {
        success: false,
        message: 'unauthorized',
      };
    }

    const studentBookedSessions = await this.prisma.book_Session.findMany({
      select: {
        id: true,
        username: true,
        status: true,
        user: {
          select: {
            id: true,
            email: true,
            address: true,
            grade_level: true,
          },
        },
      },
    });

    const totalData = await Promise.all(
      studentBookedSessions.map(async (session) => {
        const total = await this.prisma.book_Session.count({
          where: { user_id: session.user.id },
        });

        return {
          id: session.id,
          username: session.username,
          email: session.user.email,
          grade_level: session.user.grade_level,
          totalSessions: total,
          status: session.status,
          address: session.user.address,
        };
      }),
    );

    return {
      success: true,
      data: totalData,
    };
  }

  async restrictedUserAccess(
    type: string,
    restrictedId: string,
    restriction_period: Restriction_period,
    restriction_reason: string,
  ) {
    if (type !== 'admin') {
      return {
        success: false,
        message: 'Unauthorized access',
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: restrictedId },
    });

    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: restrictedId },
      data: {
        is_restricted: 1,
        restriction_period: restriction_period,
        restriction_reason: restriction_reason,
      },
    });

    return {
      success: true,
      message: 'User restricted successfully',
    };
  }

  async getRestrictedUsers(type: string) {
    if (type !== 'admin') {
      return {
        success: false,
        message: 'Unauthorized access',
        data: [],
      };
    }

    const restrictedUsers = await this.prisma.user.findMany({
      where: {
        is_restricted: 1,
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

  async unrestrictUser(type: string, userId: string) {
    if (type !== 'admin') {
      return {
        success: false,
        message: 'Unauthorized access',
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    // Update user to unrestricted
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        is_restricted: 0,
        restriction_reason: null,
        restriction_period: null,
      },
    });

    return {
      success: true,
      message: 'User unrestricted successfully',
    };
  }

  async remove(id: string, type: string) {
    if (type !== 'admin') {
      return {
        success: false,
        message: 'Unauthorized access',
      };
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    await this.prisma.user.delete({ where: { id } });
    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}
