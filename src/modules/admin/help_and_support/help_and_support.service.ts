import { Injectable } from '@nestjs/common';
import { CreateHelpAndSupportDto } from './dto/create-help_and_support.dto';
import { UpdateHelpAndSupportDto } from './dto/update-help_and_support.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HelpAndSupportService {
  constructor(private prisma: PrismaService) {}

  //create a help and support ticket forr users
  async createSupport(
    createHelpAndSupportDto: CreateHelpAndSupportDto,
    userId: string,
  ) {
    const { full_name, email, subject, message } = createHelpAndSupportDto;
    const newTicket = await this.prisma.helpAndSupport.create({
      data: {
        full_name,
        email,
        subject,
        message,
        user_id: userId,
      },
    });

    return {
      success: true,
      message: 'Help and support message created successfully.',
    };
  }
  async getAllSupport() {
    const allMessages = await this.prisma.helpAndSupport.findMany();
    return {
      success: true,
      message: 'Help and support messages fetched successfully.',
      data: allMessages,
    };
  }
  async getOneSupport(id: string) {
    const message = await this.prisma.helpAndSupport.findUnique({
      where: { id },
    });
    if (!message) {
      return {
        success: false,
        message: 'Message not found',
      };
    }
    return {
      success: true,
      message: 'Help and support message fetched successfully.',
      data: message,
    };
  }
  async toggleSupportStatus(id: string) {
    const message = await this.prisma.helpAndSupport.findUnique({
      where: { id },
      select:{
        status: true
      }
    });

    if(message.status === "unsolved"){
      await this.prisma.helpAndSupport.update({
        where: { id },
        data: { status: "solved" },
      }); 

    } else{
      await this.prisma.helpAndSupport.update({
        where: { id },
        data: { status: "unsolved" },
      }); 
    }

    return {
      success: true,
      message: 'Help and support message status updated successfully.',
      data: message,
    };
  }  

  // report section 

  async getAllreports(){
    try {
      const reports = await this.prisma.report.findMany({

      });
      return {
        success: true,
        data: reports
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching reports',
      };
    }
  }

  }

