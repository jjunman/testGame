import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from './config/app.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BandsModule } from './bands/bands.module';
import { SongsModule } from './songs/songs.module';
import { PracticeModule } from './practice/practice.module';
import { ScheduleModule } from './schedule/schedule.module';
import { StudiosModule } from './studios/studios.module';
import { PointsModule } from './points/points.module';
import { typeOrmConfig } from './database/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        typeOrmConfig(configService.get<string>('databaseUrl') ?? ''),
    }),
    AuthModule,
    UsersModule,
    BandsModule,
    SongsModule,
    PracticeModule,
    ScheduleModule,
    StudiosModule,
    PointsModule,
  ],
})
export class AppModule {}
