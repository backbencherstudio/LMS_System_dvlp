import { Injectable } from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}
  // create(createStudentDto: CreateStudentDto) {
  //   return 'This action adds a new student';
  // }

  async findAll() {
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

  findOne(id: number) {
    return `This action returns a #${id} student`;
  }

  update(id: number, updateStudentDto: UpdateStudentDto) {
    return `This action updates a #${id} student`;
  }

  remove(id: number) {
    return `This action removes a #${id} student`;
  }
}
