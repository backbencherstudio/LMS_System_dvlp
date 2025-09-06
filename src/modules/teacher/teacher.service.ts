import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session-teacher.dto';

@Injectable()
export class TeacherService {

  constructor(
    private readonly prismaService: PrismaService,  
  ) {}

  /*===========================================
        Create Teacher Session Start
  ============================================*/
   async create(createSessionDto: CreateSessionDto) {

    const session = await this.prismaService.create_Session.create({
      data: {
        user_id: createSessionDto.user_id,  
        session_type: createSessionDto.session_type,
        subject: createSessionDto.subject,
        session_charge: createSessionDto.session_charge,
        mode: createSessionDto.mode,
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
  }


  /*===========================================
         Create Teacher Session End
  ============================================*/
  /*===========================================
         Get All Session Data Start 
  ============================================*/
  async findAll() {
    return this.prismaService.create_Session.findMany();
  }
  /*===========================================
        Get All Session Data End
  ============================================*/
  /*===========================================
         Get single  Session  Data Start
  ============================================*/
  async findOne(id: string) {
    const session = await this.prismaService.create_Session.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }
  /*===========================================
           Get single  Session  Data End
  ============================================*/
  /*===========================================
        Update Teacher Session Start
  ============================================*/
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
  /*===========================================
        Update Teacher Session End
  ============================================*/
  /*===========================================
        Delete Teacher Session Start
  ============================================*/
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
  /*===========================================
        Delete Teacher Session End
  ============================================*/






// lastcurlebrate
}
