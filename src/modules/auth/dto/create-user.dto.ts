import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MinLength,
  IsEmail,
  IsOptional,
  IsBoolean,
  ValidateIf,
} from 'class-validator';

export enum UserType {
  USER = 'user',
  STUDENT = 'student',
  TEACHER = 'teacher',
}

function isStudent(obj: CreateUserDto) {
  return obj.type === UserType.STUDENT;
}

function isTeacher(obj: CreateUserDto) {
  return obj.type === UserType.TEACHER;
}

export class CreateUserDto {
  // Common value
  @IsNotEmpty()
  @ApiProperty()
  first_name?: string;

  @IsNotEmpty()
  @ApiProperty()
  last_name?: string;

  @IsNotEmpty()
  @IsEmail()
  @ApiProperty()
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8 characters' })
  @ApiProperty()
  password: string;

  @ApiProperty({
    enum: UserType,
    example: UserType.STUDENT,
  })
  type: UserType;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  phone_number: string;

  // Student value
  @ValidateIf(isStudent)
  @IsNotEmpty({ message: 'Grade level is required for students' })
  @IsString()
  @ApiProperty({ required: false })
  grade_level?: string;

  // ✅ Teacher-specific fields
  @ValidateIf(isTeacher)
  @IsNotEmpty()
  highest_education_level?: string;

  @ValidateIf(isTeacher)
  @IsNotEmpty()
  teching_experience?: string;

  @ValidateIf(isTeacher)
  @IsNotEmpty()
  @ApiProperty({
    type: [String],
    example: ['Mathematics', 'Science'],
    required: false,
  })
  subjects_taught?: string[];

  @ValidateIf(isTeacher)
  @IsNotEmpty()
  @ApiProperty({ required: false })
  hourly_rate?: number;

  @ValidateIf(isTeacher)
  @IsNotEmpty()
  @ApiProperty({ required: false })
  city?: string;

  @ValidateIf(isTeacher)
  @IsNotEmpty()
  @ApiProperty({ required: false })
  about_me?: string;

  @ValidateIf(isTeacher)
  @IsNotEmpty()
  @ApiProperty({ required: false })
  general_availability?: string;

  @ValidateIf(isTeacher)
  @IsOptional()
  @ApiProperty({ required: false })
  avatar?: string;

  @ValidateIf(isTeacher)
  @IsOptional()
  @ApiProperty({ required: false })
  certifications?: string;

  @ValidateIf(isTeacher)
  @IsBoolean()
  @IsNotEmpty()
  @ApiProperty({ required: false })
  is_agreed_terms?: boolean;

  @ValidateIf(isTeacher)
  @IsBoolean()
  @IsNotEmpty()
  @ApiProperty({ required: false })
  is_agree_application_process?: boolean;

  // Google OAuth
  @IsOptional()
  @IsString()
  @ApiProperty()
  googleId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  picture?: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  accessToken?: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  refreshToken?: string;
}
