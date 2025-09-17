import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Put } from '@nestjs/common';
import { TutorService } from './tutor.service';
import { CreateTutorDto } from './dto/create-tutor.dto';
import { UpdateTutorDto } from './dto/update-tutor.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RestrictUserDto } from './dto/restrict-user.dto';
import { AuthService } from 'src/modules/auth/auth.service';

@Controller('tutor')
export class TutorController {
  constructor(private readonly tutorService: TutorService,

  ) { }


  @UseGuards(JwtAuthGuard)
  @Get('all')
  findAll(@Req() req: any) {
    const type = req.user.type
    try {
      if (type !== 'admin') {
        return {
          success: false,
          message: 'unauthorized',
        };
      }
      else {
        return this.tutorService.getAllTutors(type);
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
    try {
      if (type !== 'admin') {
        return {
          success: false,
          message: 'unauthorized',
        };
      } else {
        return this.tutorService.getAllRestrictedTeacher(type);
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
