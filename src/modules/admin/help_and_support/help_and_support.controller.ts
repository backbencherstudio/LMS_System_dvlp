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
import { HelpAndSupportService } from './help_and_support.service';
import { CreateHelpAndSupportDto } from './dto/create-help_and_support.dto';
import { UpdateHelpAndSupportDto } from './dto/update-help_and_support.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@Controller('help-and-support')
export class HelpAndSupportController {
  constructor(private readonly helpAndSupportService: HelpAndSupportService) {}

  @UseGuards(JwtAuthGuard)
  @Post('send-us')
  createTicket(
    @Req() req: any,
    @Body() createHelpAndSupportDto: CreateHelpAndSupportDto,
  ) {
    const userId = req?.user?.userId;
    if (!userId) {
      return {
        success: false,
        message: 'Please login first',
      };
    }
    try {
      return this.helpAndSupportService.createTicket(
        createHelpAndSupportDto,
        userId,
      );
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred',
        error: error.message,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('all-messages')
  findAll(@Req() req: any) {
    const type = req.user.type;
    try {
      if (type !== 'admin') {
        return {
          success: false,
          message: 'unauthorized',
        };
      } else {
        return this.helpAndSupportService.getAllMessages();
      }
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred',
      };
    }
  }
}
