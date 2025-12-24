import {
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiBasicAuth,
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
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AttendanceDto, BulkAttendanceDTO, Scope } from './dto/attendance.dto';
import { AttendanceSearchDto } from './dto/attendance-search.dto';
import { Response } from 'express';
import { AttendanceService } from './attendance.service';
import {
  createAttendanceExamplesForSwagger,
  createBulkAttendanceExamplesForSwagger,
  searchAttendanceExamples,
} from './dto/attendance.examples';
import { GetUserId } from 'src/common/decorators/userId.decorator';

@ApiTags('Attendance')
@Controller('attendance')
@ApiBasicAuth('access-token')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @ApiCreatedResponse({
    description: 'Attendance has been created successfully.',
  })
  @ApiOperation({
    summary: 'Create Attendance',
    description:
      'Creates or updates attendance record with Kafka event publishing',
  })
  @ApiBody({
    type: AttendanceDto,
    examples: createAttendanceExamplesForSwagger,
  })
  @ApiHeader({
    name: 'tenantid',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  public async createAttendance(
    @Headers() headers,
    @Body() attendanceDto: AttendanceDto,
    @Res() response: Response,
    @GetUserId() userId: string,
    @UploadedFile() image,
  ) {
    if (!headers['tenantid']) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'tenantId is missing in headers',
      });
    }

    attendanceDto.tenantId = headers['tenantid'];
    attendanceDto.image = image?.filename;
    attendanceDto.scope = attendanceDto.scope || Scope.student; // Set default value to 'student' if not provided

    const result = await this.attendanceService.updateAttendanceRecord(
      userId, // Pass userId from query param
      attendanceDto,
      response,
    );
    return result;
  }

  @Post('list')
  @ApiOkResponse({ description: 'Attendance List' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
  @ApiOperation({ summary: 'Attendance Search' })
  @ApiBody({ type: AttendanceSearchDto, examples: searchAttendanceExamples })
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
    @GetUserId() userId: string,
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
  @ApiCreatedResponse({
    description: 'Attendance has been created successfully.',
  })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  @ApiOkResponse({ description: 'Attendance updated successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  @ApiBody({
    type: BulkAttendanceDTO,
    examples: createBulkAttendanceExamplesForSwagger,
  })
  @ApiOperation({
    summary: 'Create Bulk Attendance',
    description:
      'Processes multiple attendance records with Kafka event publishing for each operation',
  })
  @ApiHeader({
    name: 'tenantid',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  public async multipleAttendance(
    @Headers() headers,
    @Res() response: Response,
    @Body() attendanceDtos: BulkAttendanceDTO,
    @GetUserId() userId: string,
  ) {
    const tenantId = headers['tenantid'];
    if (!tenantId) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'tenantId is missing in headers',
      });
    }

    attendanceDtos.scope = Scope.student; // Set default value to 'Learner'
    const result = await this.attendanceService.multipleAttendance(
      tenantId,
      userId, // Pass userId from query param
      attendanceDtos,
      response,
    );
    return result;
  }
}
