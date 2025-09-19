import { Injectable } from '@nestjs/common';
import { CreateWebInfroDto } from './dto/create-web-infro.dto';
import { UpdateWebInfroDto } from './dto/update-web-infro.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WebInfroService {
  constructor(private prisma: PrismaService) { }



  async createAblog(createWebInfroDto: CreateWebInfroDto, userId: string, image: Express.Multer.File) {
  const checkUser = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { type: true },
  });

  if (!checkUser) {
    throw new Error('User not found');
  }

  if (checkUser.type !== 'admin') {
    throw new Error('Only admins can create a blog');
  }


  const randomName = uuidv4();
  const fileName = `${randomName}-${image.originalname.replace(/\s+/g, '_')}`;

  try {
    await SojebStorage.put(
      appConfig().storageUrl.blog + '/' + fileName,
      image.buffer,
    );
  } catch (error) {
    console.error('Image upload failed:', error);
    throw new Error('Image upload failed');
  }

    const createBlog = await this.prisma.blog.create({
    data: {
      title: createWebInfroDto.title,
      description: createWebInfroDto.description,
      category: createWebInfroDto.category,
      image: `${appConfig().storageUrl.blog}/${fileName}`,
      user_id: userId,
    },
  });


  return {
   status: 'success',
   message: 'Blog created successfully',
   data: {
    blog: createBlog,
  }
  };

}

}