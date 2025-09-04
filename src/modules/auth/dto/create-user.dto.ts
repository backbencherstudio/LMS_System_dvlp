import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class CreateUserDto {


  // common value

  @IsNotEmpty()
  @ApiProperty()
  first_name?: string;

  @IsNotEmpty()
  @ApiProperty()
  last_name?: string;

  @IsNotEmpty()
  @IsEmail()
  @ApiProperty()
  email?: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8 characters' })
  @ApiProperty()
  password: string;

  @ApiProperty({
    type: String,
    example: 'user',
  })
  type?: string;


  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  phone_number: string;  


  // Student value


  @ApiProperty()
  @IsString()
  @IsOptional()
  grade_level?: string;


  // Teacher value

   @IsOptional()
  @ApiProperty({ required: false })
  highest_education_level?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  teaching_experience?: string;

  @IsOptional()
  @ApiProperty({ type: [String], example: ['Mathematics', 'Science'], required: false })
  subjects_taught?: string[];

  @IsOptional()
  @ApiProperty({ required: false })
  hourly_rate?: number;

  @IsOptional()
  @ApiProperty({ required: false })
  city?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  about_me?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  general_availability?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  avatar?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  is_agreed_terms?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false })
  is_agree_application_process?: boolean;


}
