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

  ) {}

  @Post()
  create(@Body() createTutorDto: CreateTutorDto) {
    return this.tutorService.create(createTutorDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('all')
  findAll(@Req() req: any) {
    const type = req.user.type
    return this.tutorService.findAll(type);
  }

  
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tutorService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTutorDto: UpdateTutorDto) {
    return this.tutorService.update(+id, updateTutorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tutorService.remove(+id);
  }
}
