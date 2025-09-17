import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { HelpAndSupportService } from './help_and_support.service';
import { CreateHelpAndSupportDto } from './dto/create-help_and_support.dto';
import { UpdateHelpAndSupportDto } from './dto/update-help_and_support.dto';

@Controller('help-and-support')
export class HelpAndSupportController {
  constructor(private readonly helpAndSupportService: HelpAndSupportService) {}


}
