import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceEntity } from './entities/attendance.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from "src/common/guards/keycloak.strategy";

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEntity]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService,JwtStrategy]
})
export class AttendanceModule {}
