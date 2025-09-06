import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Put } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { CreateSessionDto } from './dto/create-session-teacher.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { log } from 'console';
import { UpdateSessionDto } from './dto/update-session-teacher.dto';

@Controller('teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  /*===========================================
          Create Teacher Session Start
  ============================================*/
  @UseGuards(JwtAuthGuard)  
  @Post('create-session')
  create(@Body() createSessionDto: CreateSessionDto,
   @Req() req: any) {
    const userId = req.user.userId;
    log('userId from JWT:', userId);
    createSessionDto.user_id = userId;
    return this.teacherService.create(createSessionDto);
  }
  /*===========================================
          Create Teacher Session Start
  ============================================*/
  /*===========================================
          Get All Session Data Start
  ============================================*/
  @Get('all-sessions')
  findAll() {
    return this.teacherService.findAll();
  }
  /*===========================================
          Get All Session Data End
  ============================================*/
  /*===========================================
         Get single  Session  Data Start
  ============================================*/
  @Get('session/:id')
  findOne(@Param('id') id: string) {
    return this.teacherService.findOne(id);
  }
  /*===========================================
           Get single  Session  Data End
  ============================================*/

  /*===========================================
          Update Teacher Session Start
  ============================================*/
  @UseGuards(JwtAuthGuard)
  @Put('update-session/:id')
  async update(@Param('id') id: string, 
  @Body() updateSessionDto: UpdateSessionDto, 
  @Req() req: any) {
    const userId = req.user.userId;
    return this.teacherService.update(id, updateSessionDto, userId); 
  }
  /*===========================================
          Update Teacher Session End
  ============================================*/
  /*===========================================
          Delete Teacher Session Start
  ============================================*/
  @UseGuards(JwtAuthGuard)  
  @Delete('delete-session/:id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.teacherService.remove(id, userId);
  }
  /*===========================================
          Delete Teacher Session Start
  ============================================*/



  
}
