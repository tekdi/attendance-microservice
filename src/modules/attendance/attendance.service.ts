import { InjectRepository } from '@nestjs/typeorm';
import { AttendanceEntity } from './entities/attendance.entity';
import { Repository, Between, In } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AttendanceSearchDto } from './dto/attendance-search.dto';
import { AttendanceDto, BulkAttendanceDTO, Scope } from './dto/attendance.dto';
import APIResponse from 'src/common/utils/response';
import { Response } from 'express';
import { LoggerService } from 'src/common/logger/logger.service';
import { KafkaService } from 'src/kafka/kafka.service';
import { BulkDeleteAttendanceDTO } from './dto/bulk-delete-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepository: Repository<AttendanceEntity>,
    private readonly loggerService: LoggerService,
    private readonly kafkaService: KafkaService,

  ) { }

  /*
    Method to search attendance for all or for the key value pair provided in filter object 
    @body an object of details consisting of attendance details of user (attendance dto)  
    @return Attendance records from attendance table for provided filters
    */

  async searchAttendance(
    tenantId: string,
    attendanceSearchDto: AttendanceSearchDto,
    response: Response,
  ) {
    const apiId = 'api.post.searchAttendance';
    try {
      let { limit, page, filters, facets, sort } = attendanceSearchDto;
      // Set default limit to 20 if not provided
      if (!limit) {
        limit = 20;
      }

      let offset = 0;
      // Calculate offset based on page number
      if (page > 1) {
        offset = limit * (page - 1);
      }

      // Get column names from metadata

      const attendanceKeys = this.attendanceRepository.metadata.columns.map(
        (column) => column.propertyName,
      );

      // Default WHERE clause for filtering by tenantId
      let whereClause: any = { tenantId };

      // construct where clause from filters
      if (filters && Object.keys(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
          if (attendanceKeys.includes(key)) {
            if (key === 'attendanceDate') {
              // For attendanceDate, consider NULL values as well
              whereClause[key] = In([value, null]);
            } else {
              whereClause[key] = value;
            }
          } else if (filters.fromDate && filters.toDate) {
            // Convert fromDate and toDate strings to Date objects
            const fromDate = new Date(filters.fromDate);
            const toDate = new Date(filters.toDate);

            // Construct the whereClause with the date range using Between
            whereClause['attendanceDate'] = Between(fromDate, toDate);
          } else {
            // If filter key is invalid (key should be a part of columns), return a BadRequest response
            this.loggerService.error(
              `Please Enter Valid Key to Search. Invalid Key entered Is ${key}`,
              'BAD_REQUEST', apiId, JSON.stringify(attendanceSearchDto)
            );
            return APIResponse.error(
              response,
              apiId,
              'BAD_REQUEST',
              `Please Enter Valid Key to Search. Invalid Key entered Is ${key}`,
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }

      let attendanceList;

      if (!facets || facets.length === 0) {
        // no facets
        let orderOption: any = {};
        if (sort && Array.isArray(sort) && sort.length === 2) {
          const [column, order] = sort;  // sort on given column
          if (attendanceKeys.includes(column)) { // column to be sorted should exist
            orderOption[column] = order.toUpperCase();
          } else {
            // If sort key is invalid, return a BadRequest response
            this.loggerService.error(
              `${column} Invalid sort key provide column name`,
              'BAD_REQUEST', apiId, JSON.stringify(attendanceSearchDto)
            );
            return APIResponse.error(
              response,
              apiId,
              'BAD_REQUEST',
              `${column} Invalid sort key provide column name`,
              HttpStatus.BAD_REQUEST,
            );
          }
        }

        attendanceList = await this.attendanceRepository.find({
          where: whereClause,
          order: orderOption, // Apply sorting option
        });
        const paginatedAttendanceList = attendanceList.slice(
          offset,
          offset + limit,
        );
        this.loggerService.log(
          'Attendance List Fetched Successfully',
          apiId,

        );
        return APIResponse.success(
          response,
          apiId,
          { data: { attendanceList: paginatedAttendanceList } },
          HttpStatus.OK,
          'Attendance List Fetched Successfully',
        );
      }
      if (facets && facets.length > 0) {
        // absent_percentage and present_percentage is valid sort key when facets are provided

        attendanceList = await this.attendanceRepository.find({
          where: whereClause,
        });

        let facetFields = [];
        // Check for invalid facets
        for (const facet of facets) {
          if (!attendanceKeys.includes(facet)) {
            // If facet is not present in attendanceKeys, return a BadRequest response
            this.loggerService.error(
              `${facet} Invalid facet`,
              'BAD_REQUEST', apiId, JSON.stringify(attendanceSearchDto)
            );
            return APIResponse.error(
              response,
              apiId,
              'BAD_REQUEST',
              `${facet} Invalid facet`,
              HttpStatus.BAD_REQUEST,
            );
          }

          facetFields.push({ name: facet, field: facet });
        }

        let result = {};
        // Process the data to calculate counts based on each facet
        for (const facet of facetFields) {
          const { field } = facet;
          const tree = await this.facetedSearch(
            attendanceList,
            [facet],
            sort,
          );

          if (!tree) {
            this.loggerService.error(
              'Invalid Sort Key for facets it has to be present_percentage or absent_percentage',
              'BAD_REQUEST', apiId, JSON.stringify(attendanceSearchDto)
            );
            return APIResponse.error(
              response,
              apiId,
              'Invalid Sort Key for facets it has to be present_percentage or absent_percentage',
              'BAD_REQUEST',
              HttpStatus.BAD_REQUEST,
            );
          }
          result[field] = tree[field];
        }

        this.loggerService.log(
          'Attendance List Fetched Successfully',
          apiId,
        );
        return APIResponse.success(
          response,
          apiId,
          {
            data: {
              result: result,
            },
          },
          HttpStatus.OK,
          'Attendance List Fetched Successfully',
        );
      }
    } catch (error) {
      const errorMessage = error.message || 'Internal Server Error';
      this.loggerService.error(
        'INTERNAL_SERVER_ERROR',
        errorMessage, apiId, JSON.stringify(attendanceSearchDto)
      );
      return APIResponse.error(
        response,
        apiId,
        'INTERNAL_SERVER_ERROR',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAttendance(userId, contextId, date) {
    let data = await this.attendanceRepository.findOne({
      where: {
        userId,
        contextId,
        attendanceDate: date,
      },
    });
    if (!data) {
      return null;
    }
    return data;
  }

  async facetedSearch(attendanceRecords, facets, sort) {
    // for each facet provided (facet is a column in table) calculate absent_percentage and present_percentage along with present and absent count for unique records 

    const tree = {};
    const attendanceKeys = new Set<string>();
    // Populate attendanceKeys with distinct attendance values

    // for each data collect unique record
    attendanceRecords.forEach((item) => {
      const attendanceValue = item.attendance;
      if (attendanceValue) {
        attendanceKeys.add(attendanceValue);
      }
    });

    // Iterate over facets
    for (const facet of facets) {
      const { field } = facet;

      // Initialize main facet in tree
      tree[field] = {};

      // Iterate over data to count occurrences of each field value
      for (const item of attendanceRecords) {
        const value = item[field];
        const attendanceValue = item['attendance'];

        // If contextId doesn't exist in the tree, initialize it with an empty object
        if (!tree[field][value]) {
          tree[field][value] = {};
        }

        // Increment count for attendanceValue
        if (!tree[field][value][attendanceValue]) {
          tree[field][value][attendanceValue] = 1;
        } else {
          tree[field][value][attendanceValue]++;
        }
      }

      // Calculate percentage for each value
      for (const value in tree[field]) {
        const counts = tree[field][value];
        const totalCount = Object.values(counts).reduce(
          (acc: number, curr: unknown) => acc + (curr as number),
          0,
        );

        for (const key in counts) {
          const count = counts[key];
          const percentage = (count / Number(totalCount)) * 100; // Convert totalCount to a number
          counts[key + '_percentage'] = percentage.toFixed(2); // Round percentage to two decimal places
        }
      }

      // Assign default values for sorting
      for (const value in tree[field]) {
        for (const attendanceValue of attendanceKeys) {
          const percentageKey = `${attendanceValue}_percentage`;
          if (!tree[field][value].hasOwnProperty(percentageKey)) {
            tree[field][value][percentageKey] = '0.00'; // Set default value internally
          }
        }
      }

      // Validate sort keys
      if (sort) {
        const [sortField, sortOrder] = sort;
        const validSortKey = `${sortField.replace('_percentage', '')}_percentage`;

        if (
          !attendanceKeys.has(sortField.replace('_percentage', '')) &&
          sortField !== 'present_percentage' &&
          sortField !== 'absent_percentage'
        ) {
          return false;
        }

        // Sort the tree based on the provided sort parameter
        tree[field] = await this.sortTree(tree[field], validSortKey, sortOrder);
      }
    }

    // Remove default values from the response
    for (const field in tree) {
      for (const value in tree[field]) {
        for (const attendanceValue of attendanceKeys) {
          const percentageKey = `${attendanceValue}_percentage`;
          if (tree[field][value][percentageKey] === '0.00') {
            delete tree[field][value][percentageKey]; // Remove default value from response
          }
        }
      }
    }

    return tree;
  }

  // Helper function to sort the tree based on the provided sortField and sortOrder
  async sortTree(tree, sortField, sortOrder) {
    const sortedTree = {};

    // Convert the object keys (values of the sortField) into an array
    const keys = Object.keys(tree);

    // Sort the keys based on the sortField and sortOrder
    keys.sort((a, b) => {
      const valueA = parseFloat(tree[a][sortField] || '0.00'); // Convert string to float
      const valueB = parseFloat(tree[b][sortField] || '0.00'); // Convert string to float

      if (sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });

    // Populate the sortedTree with sorted data
    keys.forEach((key) => {
      sortedTree[key] = tree[key];
    });

    return sortedTree;
  }
  // async attendanceReport(attendanceStatsDto: AttendanceStatsDto) {
  //   let { contextId, limit, offset, filters } = attendanceStatsDto;
  //   try {
  //     let nameFilter = '';
  //     let userFilter = '';
  //     let dateFilter = '';
  //     let queryParams: any[] = [contextId];
  //     let subqueryParams: any[] = [contextId]; // Initialize query parameters array
  //     let paramIndex = 1; // Initialize parameter index

  //     if (filters && filters.search) {
  //       nameFilter = `AND u."name" ILIKE $${++paramIndex}`; // Increment paramIndex
  //       queryParams.push(`%${filters.search.trim()}%`);
  //       subqueryParams.push(`%${filters.search.trim()}%`);
  //     }
  //     if (filters && filters.userId) {
  //       userFilter = ` AND u."userId" = $${++paramIndex}`; // Increment paramIndex
  //       queryParams.push(filters.userId.trim());
  //       subqueryParams.push(filters.userId.trim());
  //     }
  //     if (filters && filters.fromDate && filters.toDate) {
  //       dateFilter = `WHERE aa."attendanceDate" >= $${++paramIndex} AND aa."attendanceDate" <= $${++paramIndex}`;
  //       queryParams.push(filters.fromDate);
  //       queryParams.push(filters.toDate);
  //       subqueryParams.push(filters.fromDate);
  //       subqueryParams.push(filters.toDate);
  //     }

  //     let query = `
  //               SELECT
  //                   u."userId",
  //                   u."name",
  //                   CASE
  //                       WHEN aa_stats."total_attendance" = 0 THEN '-'
  //                       ELSE ROUND((aa_stats."present_count" * 100.0) / aa_stats."total_attendance", 0)::text
  //                   END AS attendance_percentage
  //               FROM
  //                   public."Users" AS u
  //               INNER JOIN
  //                   public."CohortMembers" AS cm ON cm."userId" = u."userId"
  //               LEFT JOIN
  //                   (
  //                       SELECT
  //                           aa."userId",
  //                           COUNT(*) AS "total_attendance",
  //                           COUNT(CASE WHEN aa."attendance" = 'present' THEN 1 END) AS "present_count"
  //                       FROM
  //                           public."Attendance" AS aa
  //                       ${dateFilter}
  //                       GROUP BY
  //                           aa."userId"
  //                   ) AS aa_stats ON cm."userId" = aa_stats."userId"
  //               WHERE
  //                   cm."cohortId" = $1
  //                   AND cm."role" = 'student'
  //                   ${nameFilter}
  //                   ${userFilter}
  //               GROUP BY
  //                   u."userId", u."name", aa_stats."total_attendance", aa_stats."present_count"
  //           `;

  //     if (filters) {
  //       if (
  //         filters.nameOrder &&
  //         (filters.nameOrder === 'asc' || filters.nameOrder === 'desc')
  //       ) {
  //         query += ` ORDER BY "name" ${filters.nameOrder}`;
  //       } else if (
  //         filters.percentageOrder &&
  //         (filters.percentageOrder === 'asc' ||
  //           filters.percentageOrder === 'desc')
  //       ) {
  //         query += ` ORDER BY attendance_percentage ${filters.percentageOrder}`;
  //       }
  //     }
  //     query += `
  //               LIMIT $${++paramIndex}
  //               OFFSET $${++paramIndex}`;

  //     queryParams.push(limit);
  //     queryParams.push(offset);

  //     const result = await this.attendanceRepository.query(query, queryParams);

  //     if (!filters || !filters?.userId) {
  //       // We don't need average for single user
  //       const countquery = `
  //                   SELECT ROUND(AVG(attendance_percentage::NUMERIC), 2) AS average_attendance_percentage
  //                   FROM (
  //                       SELECT
  //                           u."userId",
  //                           u."name",
  //                           CASE
  //                               WHEN aa_stats."total_attendance" = 0 THEN '-'
  //                               ELSE ROUND((aa_stats."present_count" * 100.0) / aa_stats."total_attendance", 0)::text
  //                           END AS attendance_percentage
  //                       FROM
  //                           public."Users" AS u
  //                       INNER JOIN
  //                           public."CohortMembers" AS cm ON cm."userId" = u."userId"
  //                       LEFT JOIN
  //                           (
  //                               SELECT
  //                                   aa."userId",
  //                                   COUNT(*) AS "total_attendance",
  //                                   COUNT(CASE WHEN aa."attendance" = 'present' THEN 1 END) AS "present_count"
  //                               FROM
  //                                   public."Attendance" AS aa
  //                               ${dateFilter}
  //                               GROUP BY
  //                                   aa."userId"
  //                           ) AS aa_stats ON cm."userId" = aa_stats."userId"
  //                       WHERE
  //                           cm."cohortId" = $1
  //                           AND cm."role" = 'student'
  //                           ${nameFilter}
  //                           ${userFilter}
  //                       GROUP BY
  //                           u."userId", u."name", aa_stats."total_attendance", aa_stats."present_count"
  //                   ) AS subquery`;

  //       const average = await this.attendanceRepository.query(
  //         countquery,
  //         subqueryParams,
  //       );
  //       const report = await this.mapResponseforReport(result);
  //       const response = {
  //         report,
  //         average: average[0],
  //       };
  //       return new SuccessResponse({
  //         statusCode: HttpStatus.OK,
  //         message: 'Ok.',
  //         data: response,
  //       });
  //     } else {
  //       const response = await this.mapResponseforReport(result);
  //       return new SuccessResponse({
  //         statusCode: HttpStatus.OK,
  //         message: 'Ok.',
  //         data: response,
  //       });
  //     }
  //   } catch (error) {
  //     return new ErrorResponseTypeOrm({
  //       statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  //       errorMessage: error,
  //     });
  //   }
  // }
  // public async mappedResponse(result: any) {
  //   const attendanceResponse = result.map((item: any) => {
  //     const dateObject = new Date(item.attendanceDate);
  //     const formattedDate = moment(dateObject).format('YYYY-MM-DD');
  //     const attendanceMapping = {
  //       tenantId: item?.tenantId ? `${item.tenantId}` : '',
  //       attendanceId: item?.attendanceId ? `${item.attendanceId}` : '',
  //       userId: item?.userId ? `${item.userId}` : '',
  //       attendanceDate: item.attendanceDate ? formattedDate : null,
  //       attendance: item?.attendance ? `${item.attendance}` : '',
  //       remark: item?.remark ? `${item.remark}` : '',
  //       latitude: item?.latitude ? item.latitude : 0,
  //       longitude: item?.longitude ? item.longitude : 0,
  //       image: item?.image ? `${item.image}` : '',
  //       metaData: item?.metaData ? item.metaData : [],
  //       syncTime: item?.syncTime ? `${item.syncTime}` : '',
  //       session: item?.session ? `${item.session}` : '',
  //       contextId: item?.contextId ? `${item.contextId}` : '',
  //       contextType: item?.contextType ? `${item.contextType}` : '',
  //       createdAt: item?.createdAt ? `${item.createdAt}` : '',
  //       updatedAt: item?.updatedAt ? `${item.updatedAt}` : '',
  //       createdBy: item?.createdBy ? `${item.createdBy}` : '',
  //       updatedBy: item?.updatedBy ? `${item.updatedBy}` : '',
  //       username: item?.username ? `${item.username}` : '',
  //       role: item?.role ? `${item.role}` : '',
  //     };

  //     return new AttendanceDto(attendanceMapping);
  //   });

  //   return attendanceResponse;
  // }

  // public async mapResponseforReport(result: any) {
  //   const attendanceReport = result.map((item: any) => {
  //     const attendanceReportMapping = {
  //       name: item?.name ? `${item.name}` : '',
  //       userId: item?.userId ? `${item.userId}` : '',
  //       attendance_percentage: item?.attendance_percentage
  //         ? `${item.attendance_percentage}`
  //         : '',
  //     };

  //     return new AttendanceStatsDto(attendanceReportMapping);
  //   });return attendanceReport;
  // }

  // public async mapAttendanceRecord(result: any) {
  //   const attendanceRecords = result.map((item: any) => {
  //     const dateObject = new Date(item.attendanceDate);
  //     const formattedDate = moment(dateObject).format('YYYY-MM-DD');

  //     let attendance = {
  //       name: item?.name ? `${item.name}` : '',
  //       userId: item?.userId ? `${item.userId}` : '',
  //       attendance: item?.attendance ? `${item.attendance}` : '',
  //       attendanceDate: item.attendanceDate ? formattedDate : null,
  //     };
  //     return new AttendanceStatsDto(attendance);
  //   });

  //   return attendanceRecords;
  // }
  /* 
    Method to create,update or add attendance for valid user in attendance table with Kafka event publishing
    @body an object of details consisting of attendance details of user (attendance dto)  
    @publishes Kafka events on successful create/update operations
    @return updated details of attendance record 
    */

  public async updateAttendanceRecord(
    loginUserId: string | null,
    attendanceDto: AttendanceDto,
    res: Response,
  ) {
    let apiId = 'api.post.createAttendanceRecord';
    try {
      const attendanceFound = await this.updateAttendance(
        attendanceDto,
        loginUserId,
      );
      if (attendanceFound) {
        this.loggerService.log(
          'Attendance updated successfully',
          apiId,
          loginUserId
        );
        this.publishAttendanceEvent('updated', attendanceFound.attendanceId, apiId)
        return APIResponse.success(
          res,
          apiId,
          { data: attendanceFound },
          HttpStatus.OK,
          'Attendance updated successfully',
        );
      } else {
        if (!attendanceDto.scope) {
          attendanceDto.scope = Scope.student;
        }
        attendanceDto.createdBy = loginUserId;
        attendanceDto.updatedBy = loginUserId;
        let attendanceCreated = await this.createAttendance(attendanceDto);
        this.loggerService.log(
          'Attendance created successfully',
          apiId,
          loginUserId
        );
        this.publishAttendanceEvent('created', attendanceCreated.attendanceId, apiId)
        // .catch(error => LoggerUtil.error(
        //   `Failed to publish user updated event to Kafka`,
        //   `Error: ${error.message}`,
        //   apiId
        // ));
        return APIResponse.success(
          res,
          apiId,
          { data: attendanceCreated },
          HttpStatus.CREATED,
          'Attendance created successfully',
        );
      }
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'INTERNAL_SERVER_ERROR',
        errorMessage, apiId, loginUserId
      );
      return APIResponse.error(
        res,
        apiId,
        'Internal Server Error',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  /*Method to update attendance for userId
    @return updated attendance record based on attendanceId
    */
  public async updateAttendance(
    attendanceDto: AttendanceDto,
    loginUserId: string,
  ) {
    try {
      attendanceDto.updatedBy = loginUserId;
      let attendancefound = await this.findAttendance(
        attendanceDto.userId,
        attendanceDto.contextId,
        attendanceDto.attendanceDate,
      );
      if (!attendancefound) {
        return false;
      }
      let data = this.attendanceRepository.merge(
        attendancefound,
        attendanceDto,
      );
      const updatedAttendanceRecord =
        await this.attendanceRepository.save(data);
      return updatedAttendanceRecord;
    } catch (error) {
      return error;
    }
  }

  public async createAttendance(attendanceDto: AttendanceDto) {
    try {
      const attendance = this.attendanceRepository.create(attendanceDto);
      const result = await this.attendanceRepository.save(attendance);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /*Method to search attendance fromDate to toDate 
    @body object containing attendance date details for user (AttendanceDateDto)
    @return attendance records from fromDate to toDate     */

  // public async attendanceByDate(
  //   tenantId: string,
  //   request: any,
  //   attendanceSearchDto: AttendanceDateDto,
  // ) {
  //   try {
  //     let { limit, page } = attendanceSearchDto;
  //     if (!limit) {
  //       limit = '0';
  //     }

  //     let offset = 0;
  //     if (page > 1) {
  //       offset = parseInt(limit) * (page - 1);
  //     }

  //     const fromDate = new Date(attendanceSearchDto.fromDate);
  //     const toDate = new Date(attendanceSearchDto.toDate);

  //     let whereClause: any = {
  //       tenantId: tenantId ? tenantId : '',
  //       attendanceDate: Between(fromDate, toDate),
  //     };

  //     // Add additional filters if present
  //     if (attendanceSearchDto.filters) {
  //       Object.keys(attendanceSearchDto.filters).forEach((key) => {
  //         whereClause[key] = attendanceSearchDto.filters[key];
  //       });
  //     }

  //     const [results, totalCount] =
  //       await this.attendanceRepository.findAndCount({
  //         where: whereClause,
  //         take: parseInt(limit),
  //         skip: offset,
  //       });

  //     const mappedResponse = await this.mappedResponse(results);

  //     return new SuccessResponse({
  //       statusCode: HttpStatus.OK,
  //       message: 'Ok',
  //       totalCount: totalCount,
  //       data: mappedResponse,
  //     });
  //   } catch (e) {
  //     return new ErrorResponseTypeOrm({
  //       statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  //       errorMessage: e,
  //     });
  //   }
  // }

  /*Method to add multiple attendance records in Attendance table with Kafka event publishing
    @body Array of objects containing attendance details of user (AttendanceDto)
    @publishes Kafka events for each created/updated attendance record
    */

  public async multipleAttendance(
    tenantId: string,
    userId: string | null,
    attendanceData: BulkAttendanceDTO,
    res: Response,
  ) {
    const loginUserId = userId;
    const results = [];
    const errors = [];
    let apiId = 'api.post.bulkAttendance';

    try {
      let count = 0;

      for (let attendance of attendanceData.userAttendance) {
        const userAttendance = new AttendanceDto({
          attendanceDate: attendanceData.attendanceDate,
          contextId: attendanceData?.contextId,
          context: attendanceData?.context,
          scope: attendanceData?.scope,
          attendance: attendance?.attendance,
          userId: attendance?.userId,
          tenantId: tenantId,
          remark: attendance?.remark,
          latitude: attendance?.latitude,
          longitude: attendance?.longitude,
          image: attendance?.image,
          metaData: attendance?.metaData,
          syncTime: attendance?.syncTime,
          session: attendance?.session,
          createdBy: loginUserId,
          updatedBy: loginUserId,
        });

        try {
          const attendanceRes = await this.updateAttendance(
            userAttendance,
            loginUserId,
          );
          if (!attendanceRes) {
            let createAttendance = await this.createAttendance(userAttendance);
            results.push({ status: 'created', attendance: createAttendance });
            this.publishAttendanceEvent('created', createAttendance.attendanceId, apiId);
          } else {
            results.push({ status: 'updated', attendance: attendanceRes });
            this.publishAttendanceEvent('updated', attendanceRes.attendanceId, apiId);
          }
          count++;
        } catch (e) {
          errors.push({ attendance, error: e.message });
        }
      }
      if (errors.length > 0) {
        if (!results.length) {
          this.loggerService.error(
            'BAD_REQUEST',
            `Attendance Can not be created or updated.Error is ${errors[0].error}`,
            apiId,
            userId
          );
          return APIResponse.error(
            res,
            apiId,
            'BAD_REQUEST',
            `Attendance Can not be created or updated.Error is ${errors[0].error}`,
            HttpStatus.BAD_REQUEST,
          );
        }
        this.loggerService.log(
          'Attendance created successfully',
          apiId,
          userId
        );
        return APIResponse.success(
          res,
          apiId,
          { count: count, errors: errors, successresults: results },
          HttpStatus.CREATED,
          'Bulk Attendance Processed with some errors',
        );
      } else {
        this.loggerService.log(
          'Attendance created successfully',
          apiId,
          userId
        );
        return APIResponse.success(
          res,
          apiId,
          { totalCount: count, responses: results },
          HttpStatus.CREATED,
          'Bulk Attendance Updated successfully',
        );
      }
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Internal Server Error',
        e.message,
        apiId,
        userId
      );
      return APIResponse.error(
        res,
        apiId,
        'Internal Server Error',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  private async publishAttendanceEvent(
    eventType: 'created' | 'updated' | 'deleted',
    attendanceId: string,
    apiId: string
  ): Promise<void> {
    try {      
      // For delete events, we may want to include just basic information since the attendance might already be removed
      let attendanceData: any;
      
      if (eventType === 'deleted') {
        attendanceData = {
          attendanceId: attendanceId,
          deletedAt: new Date().toISOString()
        };
      } else {
        // For create and update, fetch complete data from DB
        try {
          // Get basic user information
          attendanceData = await this.attendanceRepository.findOne({
            where: { attendanceId: attendanceId },
          });
        } catch (error) {
          attendanceData = { attendanceId };          
        }
      }

      await this.kafkaService.publishAttendanceEvent(eventType, attendanceData, attendanceId);
      // LoggerUtil.log(`attendance ${eventType} event published to Kafka for attendance ${attendanceId}`, apiId);
    } catch (error) {
      // LoggerUtil.error(
      //   `Failed to publish user ${eventType} event to Kafka`,
      //   `Error: ${error.message}`,
      //   apiId
      // );
      // Don't throw the error to avoid affecting the main operation
    }
  }

  /*Method to validate individual attendance record for deletion
    @return validation errors array or empty array if valid
    */
  private validateDeleteRecord(record: any, index: number): string[] {
    const errors = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Validate userId
    if (!record.userId || typeof record.userId !== 'string' || record.userId.trim() === '') {
      errors.push(`attendanceRecords[${index}].userId: userId is required and must be a non-empty string`);
    }

    // Validate contextId
    if (!record.contextId || typeof record.contextId !== 'string' || record.contextId.trim() === '') {
      errors.push(`attendanceRecords[${index}].contextId: contextId is required and must be a non-empty string`);
    }

    // Validate date format
    if (!record.date || typeof record.date !== 'string') {
      errors.push(`attendanceRecords[${index}].date: date is required and must be a string`);
    } else if (!dateRegex.test(record.date)) {
      errors.push(`attendanceRecords[${index}].date: Please provide a valid date in the format yyyy-mm-dd`);
    } else {
      // Validate if it's a valid calendar date
      const dateParts = record.date.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      const day = parseInt(dateParts[2], 10);
      const dateObj = new Date(year, month - 1, day);
      
      if (
        dateObj.getFullYear() !== year ||
        dateObj.getMonth() !== month - 1 ||
        dateObj.getDate() !== day
      ) {
        errors.push(`attendanceRecords[${index}].date: The date provided is not a valid calendar date`);
      }
    }

    return errors;
  }

  /*Method to bulk delete attendance records
    @body Array of objects containing userId, contextId, and date to delete
    @return deletion summary with counts
    */
  public async bulkDeleteAttendance(
    tenantId: string,
    requestUserId: string,
    bulkDeleteDto: BulkDeleteAttendanceDTO,
    res: Response,
  ) {
    const apiId = 'api.delete.bulkDeleteAttendance';
    const results = [];
    const errors = [];
    let count = 0;

    try {
      // Check if attendanceRecords array is provided and not empty
      if (!bulkDeleteDto.attendanceRecords || bulkDeleteDto.attendanceRecords.length === 0) {
        this.loggerService.error(
          'BAD_REQUEST',
          'At least one record must be provided for deletion',
          apiId,
          requestUserId
        );
        return APIResponse.error(
          res,
          apiId,
          'BAD_REQUEST',
          'At least one record must be provided for deletion',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Process each delete request
      for (let index = 0; index < bulkDeleteDto.attendanceRecords.length; index++) {
        const record = bulkDeleteDto.attendanceRecords[index];
        
        try {
          // Validate the record
          const validationErrors = this.validateDeleteRecord(record, index);
          
          if (validationErrors.length > 0) {
            // Record has validation errors
            errors.push({
              record: {
                userId: record.userId,
                contextId: record.contextId,
                date: record.date,
              },
              index: index,
              error: validationErrors.join('; '),
            });
            continue;
          }

          // First, check if the attendance record exists using existing method
          const attendanceFound = await this.findAttendance(
            record.userId,
            record.contextId,
            new Date(record.date),
          );

          if (!attendanceFound) {
            // Record not found
            errors.push({
              record: {
                userId: record.userId,
                contextId: record.contextId,
                date: record.date,
              },
              index: index,
              error: 'Attendance record not found',
            });
            continue;
          }

          // Check tenant isolation - ensure the found record belongs to the tenant
          if (attendanceFound.tenantId !== tenantId) {
            errors.push({
              record: {
                userId: record.userId,
                contextId: record.contextId,
                date: record.date,
              },
              index: index,
              error: 'Attendance record not found', // Don't expose cross-tenant info
            });
            this.loggerService.warn(
              `Attempted cross-tenant deletion blocked for user ${record.userId}`,
              apiId
            );
            continue;
          }

          // Record exists and belongs to correct tenant, proceed with deletion
          const deleteResult = await this.attendanceRepository.delete({
            attendanceId: attendanceFound.attendanceId,
          });

          if (deleteResult.affected > 0) {
            results.push({
              status: 'deleted',
              attendance: {
                userId: record.userId,
                contextId: record.contextId,
                date: record.date,
                attendanceId: attendanceFound.attendanceId,
              },
            });
            count++;
          } else {
            errors.push({
              record: {
                userId: record.userId,
                contextId: record.contextId,
                date: record.date,
              },
              index: index,
              error: 'Failed to delete attendance record',
            });
          }
        } catch (e) {
          this.loggerService.error(
            'Error deleting individual record',
            e.message,
            apiId,
            requestUserId
          );
          errors.push({
            record: {
              userId: record.userId,
              contextId: record.contextId,
              date: record.date,
            },
            index: index,
            error: e.message,
          });
        }
      }

      // Return response based on results (matching bulkAttendance pattern)
      if (errors.length > 0) {
        if (!results.length) {
          // All records failed
          this.loggerService.error(
            'BAD_REQUEST',
            `Attendance records cannot be deleted. Error: ${errors[0].error}`,
            apiId,
            requestUserId
          );
          return APIResponse.error(
            res,
            apiId,
            'BAD_REQUEST',
            `Attendance records cannot be deleted. Error: ${errors[0].error}`,
            HttpStatus.BAD_REQUEST,
          );
        }
        // Partial success
        this.loggerService.log(
          `Bulk delete processed with some errors. Deleted: ${count}, Errors: ${errors.length}`,
          apiId,
          requestUserId
        );
        return APIResponse.success(
          res,
          apiId,
          { totalCount: count, errors: errors, successfulDeletions: results },
          HttpStatus.OK,
          'Bulk Attendance Delete processed with some errors',
        );
      } else {
        // All successful
        this.loggerService.log(
          `Bulk delete completed successfully. Deleted: ${count}`,
          apiId,
          requestUserId
        );
        return APIResponse.success(
          res,
          apiId,
          { totalCount: count, deletedAttendance: results },
          HttpStatus.OK,
          'Bulk Attendance Deleted successfully',
        );
      }
    } catch (e) {
      const errorMessage = e.message || 'Internal Server Error';
      this.loggerService.error(
        'Internal Server Error',
        e.message,
        apiId,
        requestUserId
      );
      return APIResponse.error(
        res,
        apiId,
        'Internal Server Error',
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
