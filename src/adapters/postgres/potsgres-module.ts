import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";




@Module({
    imports: [HttpModule,
    TypeOrmModule.forFeature([
    ])
    ],
    providers: [
     
    ],
    exports: [
        
    ],
  })
  export class PostgresModule {}
  