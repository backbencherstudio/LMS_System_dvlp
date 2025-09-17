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
import { stat } from 'fs';

@Controller('student')
export class StudentController {
  constructor(private readonly studentService: StudentService) { }

  @UseGuards(JwtAuthGuard)
  @Get('book-sessions')
  findAll(@Req() req: any) {
    const type = req.user.type;
    try {
      if (type !== 'admin') {
        return {
          success: false,
          message: 'unauthorized',
        };
      } else {
        return this.studentService.getAllstudetnds(type);
      }
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred while deleting the user.',
        error: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('restricted-users')
  getRestrictedUsers(@Req() req: any) {
    const type = req.user.type;
    console.log('type from token', type);
    try {
      if (type !== 'admin') {
        return {
          success: false,
          message: 'unauthorized',
        };
      }
      else {
        return this.studentService.getRestrictedUsers();
      }
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred while fetching restricted users.',
        error: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('restricted-user/:restrictedId')
  restrictedUserAccess(
    @Param('restrictedId') restrictedId: string,
    @Body() dto: RestrictedUserDto,
    @Req() req: any,
  ) {
    const type = req.user.type;
    try {
      if (type !== 'admin') {
        return {
          success: false,
          message: 'unauthorized',
        };
      } else {
        return this.studentService.restrictedUserAccess(
          type,
          restrictedId,
          dto.restriction_period,
          dto.restriction_reason,
        );
      }
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred while restricting the user.',
        error: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('unrestrict-user/:userId')
  unrestrictUser(@Param('userId') userId: string, @Req() req: any) {
    const type = req.user.type;
    try {
      if (type !== 'admin') {
        return {
          success: false,
          message: 'unauthorized',
        };
      } else {
        return this.studentService.unrestrictAUser(type, userId);
      }
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred while unrestricting the user.',
        error: error.message,
      };
    }

  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') userId: string, @Req() req: any) {
    const type = req.user.type;
    try {
      if (type !== 'admin') {
        return {
          success: false,
          message: 'unauthorized',
        };
      }
      else {
        return this.studentService.delete(userId, type);
      }
    } catch (error) {

      return {
        success: false,
        message: 'An error occurred while deleting the user.',
        error: error.message,
      };
    }
  }
}
