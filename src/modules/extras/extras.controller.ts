import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExtrasService } from './extras.service';
import { CreateReportDto } from './dto/create-report.dto';



@Controller('extras')
export class ExtrasController {
  constructor(private readonly extrasService: ExtrasService) { }

  @Post('report/:reported_id')
  @UseGuards(JwtAuthGuard)
  async createReport(
    @Param('reported_id') reportedId: string,
    @Body() createReportDto: CreateReportDto,
    @Req() req: any,
  ) {
    const reporterId = req.user.userId;
  console.log('Reporter ID:', reporterId);
  console.log('Reported ID:', reportedId);
    
    return this.extrasService.createReport(createReportDto, reporterId , reportedId);
  }


}
