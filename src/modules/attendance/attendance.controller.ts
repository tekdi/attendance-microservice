import {
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBasicAuth,
  ApiHeader,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import {
  Controller,
  Post,
  Body,
  SerializeOptions,
  Req,
  Request,
  UploadedFile,
  Headers,
  UsePipes,
  ValidationPipe,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { AttendanceDto, BulkAttendanceDTO } from './dto/attendance.dto';
import { AttendanceSearchDto } from './dto/attendance-search.dto';
import { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from 'src/common/guards/keycloak.guard';

@ApiTags('Attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @ApiBasicAuth('access-token')
  @ApiCreatedResponse({
    description: 'Attendance has been created successfully.',
  })
  @ApiBody({ type: AttendanceDto })
  @ApiHeader({
    name: 'tenantid',
  })
  @UsePipes(ValidationPipe)
  public async createAttendace(
    @Headers() headers,
    @Req() request,
    @Body() attendanceDto: AttendanceDto,
    @Res() response: Response,
    @UploadedFile() image,
  ) {
    let userId = request?.user?.userId;
    attendanceDto.tenantId = headers['tenantid'];
    if (!headers['tenantid']) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'tenantId is missing in headers',
      });
    }

    attendanceDto.image = image?.filename;
    //currently set default value to student
    attendanceDto.scope = 'student';
    const result = await this.attendanceService.updateAttendanceRecord(
      userId,
      attendanceDto,
      response,
    );
    return result;
  }

  @Post('list')
  @ApiBasicAuth('access-token')
  @ApiOkResponse({ description: 'Attendance List' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiBody({ type: AttendanceSearchDto })
  // @UseInterceptors(ClassSerializerInterceptor)
  @UsePipes(ValidationPipe)
  @SerializeOptions({
    strategy: 'excludeAll',
  })
  @ApiHeader({
    name: 'tenantid',
  })
  public async searchAttendanceNew(
    @Headers() headers,
    @Req() request: Request,
    @Body() studentSearchDto: AttendanceSearchDto,
    @Res() response: Response,
  ) {
    let tenantid = headers['tenantid'];
    if (!tenantid) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'tenantId is missing in headers',
      });
    }
    const result = await this.attendanceService.searchAttendance(
      tenantid,
      studentSearchDto,
      response,
    );
    return result;
  }

  @Post('bulkAttendance')
  @ApiBasicAuth('access-token')
  @ApiCreatedResponse({
    description: 'Attendance has been created successfully.',
  })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  @ApiOkResponse({ description: 'Attendance updated successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  @ApiBody({ type: BulkAttendanceDTO })
  @ApiHeader({
    name: 'tenantid',
  })
  @UsePipes(ValidationPipe)
  public async multipleAttendance(
    @Headers() headers,
    @Req() request: Request,
    @Res() response: Response,
    @Body() attendanceDtos: BulkAttendanceDTO,
  ) {
    let tenantId = headers['tenantid'];
    if (!tenantId) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'tenantId is missing in headers',
      });
    }
    //currently set default value to student
    attendanceDtos.scope = 'student';
    const result = await this.attendanceService.multipleAttendance(
      tenantId,
      request,
      attendanceDtos,
      response,
    );
    return result;
  }
}
