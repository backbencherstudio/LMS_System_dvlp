import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { CreateWebInfroDto } from './dto/create-web-infro.dto';
import { WebInfroService } from './web-infro.service';
import { UpdateWebInfroDto } from './dto/update-web-infro.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('web-infro')
export class WebInfroController {
  constructor(private readonly webInfroService: WebInfroService) {}


  @ApiOperation({ summary: 'Create a blog' })
  @ApiBearerAuth()  
  @UseGuards(JwtAuthGuard)  
  @Post('create') 
  @UseInterceptors(
    FileInterceptor('image', {  
      storage: memoryStorage(),  
    }),
  )
  async createBlog(
    @Req() req: any,  
    @Body() data: CreateWebInfroDto,  
    @UploadedFile() image: Express.Multer.File, 
  ) {
    try {
     const userId = req.user.userId;
      const response = await this.webInfroService.createAblog(data, userId, image);

      return response;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create blog',
        error: error.message,
      };
    }
  }



}
