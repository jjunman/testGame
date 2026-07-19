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
import { SettlementModule } from './settlement/settlement.module';
import { typeOrmConfig } from './database/typeorm.config';
import { HealthController } from './health.controller';
import { AppLinksController } from './app-links.controller';
import { KakaoMapController } from './kakao-map.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        typeOrmConfig(
          configService.get<string>('databaseUrl') ?? '',
          configService.get<boolean>('databaseSynchronize') ?? false,
        ),
    }),
    AuthModule,
    UsersModule,
    BandsModule,
    SongsModule,
    PracticeModule,
    ScheduleModule,
    StudiosModule,
    SettlementModule,
  ],
  controllers: [HealthController, AppLinksController, KakaoMapController],
})
export class AppModule {}
