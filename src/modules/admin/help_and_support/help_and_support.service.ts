import { Injectable } from '@nestjs/common';
import { CreateHelpAndSupportDto } from './dto/create-help_and_support.dto';
import { UpdateHelpAndSupportDto } from './dto/update-help_and_support.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HelpAndSupportService {
  constructor(
    private prisma: PrismaService
  ) { }

  //create a help and support ticket forr users
  async createTicket(createHelpAndSupportDto: CreateHelpAndSupportDto , userId: string) {
   
  }

}
