import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RestrictedUserDto } from './dto/restricted-user.dto';

@Controller('student')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @UseGuards(JwtAuthGuard)
  @Get('book-sessions')
  findAll(@Req() req: any) {
    const type = req.user.type;
    return this.studentService.findAll(type);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('restricted-user/:restrictedId')
  restrictedUserAccess(
    @Param('restrictedId') restrictedId: string,
    @Body() dto: RestrictedUserDto,
    @Req() req: any,
  ) {
    const type = req.user.type;
    return this.studentService.restrictedUserAccess(
      type,
      restrictedId,
      dto.restriction_period,
      dto.restriction_reason,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('restricted-users')
  getRestrictedUsers(@Req() req: any) {
    const type = req.user.type;
    return this.studentService.getRestrictedUsers(type);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('unrestrict-user/:userId')
  unrestrictUser(@Param('userId') userId: string, @Req() req: any) {
    const type = req.user.type;
    return this.studentService.unrestrictUser(type, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') userId: string, @Req() req: any) {
    const type = req.user.type;
    return this.studentService.remove(userId, type);
  }
}
