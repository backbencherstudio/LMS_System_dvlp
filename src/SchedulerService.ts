import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class SchedulerService {

  constructor(private readonly prisma: PrismaService) {}
@Cron(CronExpression.EVERY_HOUR)  
async handleHourlyCron() {
  const now = new Date();
  console.log('Cron executed at:', now);

  const sessionsToUpdate = await this.prisma.book_Session.findMany({
    where: {
      is_joined: 1, 
      is_completed: 0, 
      session_date: {
        lte: new Date(now.getTime() - 60 * 60 * 1000),  
      },
    },
    select: {
      id: true,
      session_date: true,
      create_session: { 
        select: { id: true },
      },
    },
  });

  for (const session of sessionsToUpdate) {
    const sessionDate = new Date(session.session_date);
    const timeDiff = now.getTime() - sessionDate.getTime();
    const oneHourInMillis = 60 * 60 * 1000; // 1 hour in milliseconds

    if (timeDiff >= oneHourInMillis) {
      await this.prisma.book_Session.update({
        where: { id: session.id },
        data: {
          is_completed: 1,  
          session_period: "60",  
        },
      });
      console.log(`Session ${session.id} marked as completed.`);

      if (session.create_session?.id) {
        await this.prisma.create_Session.update({
          where: { id: session.create_session.id },
          data: {
            is_completed: 1,
          },
        });
        console.log(`Create session ${session.create_session.id} marked as completed.`);
      }
    }
  }
}

}
