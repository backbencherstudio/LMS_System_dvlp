import { Injectable } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ExtrasService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }
  async createReport(createReportDTO: CreateReportDto, reporterId: string, reportedId: string) {

    //students cannot report themselves
    if (reporterId === reportedId) {
      throw new Error("You cannot report yourself");
    }

    //same user.type cannot report each other
    const reporter = await this.prismaService.user.findUnique({
      where: { id: reporterId },
    });
    const reported = await this.prismaService.user.findUnique({
      where: { id: reportedId },
    });
    if (reporter.type === reported.type) {
      throw new Error("You cannot report a user of the same type");
    }

    //students can rport only those teaher who have taken their sessions
    if (reporter.type === 'student' && reported.type === 'teacher') {
      const sessions = await this.prismaService.book_Session.findMany({
        where: {
          user_id: reporterId,
        },
        select: {
          create_session: {
            where: { user_id: reportedId }
          }
        }
      });

      if (sessions.length === 0) {
        throw new Error("You can report only those teachers who have taken your sessions");
      }

    }

    //techers can report only those students who have attended their sessions
    if (reporter.type === 'teacher' && reported.type === 'student') {
      const sessions = await this.prismaService.book_Session.findMany({
        where: {
          user_id: reportedId,
        },
        select: {
          create_session: {
            where: { user_id: reporterId }
          }
        }
      });
      if (sessions.length === 0) {
        throw new Error("You can report only those students who have attended your sessions");
      }
    }


    const report = await this.prismaService.report.create({
      data: {
        reason: createReportDTO.reason,
        description: createReportDTO.description,
        reporter_id: reporterId,
        reported_id: reportedId,
      }
    });
    return report;



  }
}
