import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Put } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { CreateSessionDto } from './dto/create-session-teacher.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { log } from 'console';
import { UpdateSessionDto } from './dto/update-session-teacher.dto';
import { acceptReqDto } from './dto/accept-req.dto';
import { use } from 'passport';

@Controller('teacher')
export class TeacherController {
        constructor(private readonly teacherService: TeacherService) { }

        @UseGuards(JwtAuthGuard)
        @Post('create-session')
        create(@Body() createSessionDto: CreateSessionDto,
                @Req() req: any) {
                const userId = req.user.userId;
                createSessionDto.user_id = userId;
                return this.teacherService.create(createSessionDto);
        }

        @Get('all-sessions')
        findAll() {
                return this.teacherService.findAll();
        }


        @Get('all-booked-sessions/:id')
        findAllBookedSessions(
                @Req() req: any
        ) {
                const userId = req.user.userId;
                return this.teacherService.getAllBookedSessionsForOneTeacher(userId);
        }

        @UseGuards(JwtAuthGuard)
        @Get('reschedule-requests')
        getAllRescheduleRequests(
                @Req() req: any
        ) {
                const userId = req.user.userId;
                return this.teacherService.getallRequestsForReschedule(userId);
        }


        @Get("allteacher")
        getAllTeachers() {
                return this.teacherService.getAllTeachers();
        }

        @UseGuards(JwtAuthGuard)
        @Get('my-sessions')
        mySessions(
                @Req() req: any
        ) {
                const id = req.user.userId;
                return this.teacherService.getAllSessionsForOneTeacher(id);
        }

 
        @Get('my-sessions/:id')
        mySessionsForStudents(
                @Param('id') id: string
        ) {        
                return this.teacherService.getAllSessionsForOneTeacher(id);
        }



        @UseGuards(JwtAuthGuard)
        @Get('my-ended-sessions')
        myEndedSessions(@Req() req: any) {
                const userId = req.user.userId;
                return this.teacherService.getallEndedSessionsForOneTeacher(userId);
        }

        @Get('session/:id')
        findOne(@Param('id') id: string) {
                return this.teacherService.findOne(id);
        }


        @Get('get/:id')
        getOneTeacher(@Param('id') id: string) {
                return this.teacherService.getATeacherById(id);
        }

        @UseGuards(JwtAuthGuard)
        @Put('update-session/:id')
        async update(@Param('id') id: string,
                @Body() updateSessionDto: UpdateSessionDto,
                @Req() req: any) {
                const userId = req.user.userId;
                return this.teacherService.update(id, updateSessionDto, userId);
        }

        @UseGuards(JwtAuthGuard)
        @Delete('delete-session/:id')
        remove(@Param('id') id: string, @Req() req: any) {
                const userId = req.user.userId;
                return this.teacherService.remove(id, userId);
        }

        @UseGuards(JwtAuthGuard)
        @Post(':action/:requestId')
        async handleRescheduleRequest(
                @Param('action') action: string,
                @Param('requestId') requestId: string,
                @Body() acceptDto: acceptReqDto,
                @Req() req: any
        ) {
                if (action !== 'accept' && action !== 'reject') {
                        return { message: 'Invalid action. Please use "accept" or "reject".' };
                }

                const userId = req.user.userId;

                const result = await this.teacherService.handleRequest(
                        requestId,
                        userId,
                        action,
                        acceptDto,
                );
                return result;
        }



}
