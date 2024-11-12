import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AttendanceEntity } from './entities/attendance.entity';
import { Repository, Between, In } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AttendanceSearchDto } from './dto/attendance-search.dto';
import { AttendanceDto, BulkAttendanceDTO } from './dto/attendance.dto';
import APIResponse from 'src/common/utils/response';
import { Response } from 'express';

// import { CohortMembers } from 'src/cohortMembers/entities/cohort-member.entity';
// const facetedSearch = require('in-memory-faceted-search');

@Injectable()
export class AttendanceService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(AttendanceEntity)
    private attendanceRepository: Repository<AttendanceEntity>,
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
    let apiId = 'api.post.seacrhAttendance';
    try {
      let { limit, page, filters, facets, sort } = attendanceSearchDto;
      // Set default limit to 0 if not provided
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

      let whereClause: any = { tenantId };
      // Default WHERE clause for filtering by tenantId

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
            // If filter key is invalid, return a BadRequest response
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

      if (!facets) {
        let orderOption: any = {};
        if (sort && Array.isArray(sort) && sort.length === 2) {
          const [column, order] = sort;
          if (attendanceKeys.includes(column)) {
            orderOption[column] = order.toUpperCase();
          } else {
            // If sort key is invalid, return a BadRequest response
            return APIResponse.error(
              response,
              apiId,
              'BAD_REQUEST',
              `${column} Invalid sort key`,
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
        // return new SuccessResponse({
        //   statusCode: HttpStatus.OK,
        //   message: 'Ok.',
        //   data: {
        //     attendanceList: paginatedAttendanceList,
        //   },
        // });
        return APIResponse.success(
          response,
          apiId,
          //{ attendanceList: { data: paginatedAttendanceList } },
          { data: { attendanceList: paginatedAttendanceList } },
          HttpStatus.OK,
          'Ateendance List Fetched Successfully',
        );
      }
      if (facets && facets.length > 0) {
        attendanceList = await this.attendanceRepository.find({
          where: whereClause, // Apply sorting option
        });

        let facetFields = [];
        // Check for invalid facets
        for (const facet of facets) {
          if (!attendanceKeys.includes(facet)) {
            // If facet is not present in attendanceKeys, return a BadRequest response
            // return new ErrorResponseTypeOrm({
            //   statusCode: HttpStatus.BAD_REQUEST,
            //   errorMessage: `${facet} Invalid facet`,
            // });
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
        // Process the data to calculate counts based on facets
        for (const facet of facetFields) {
          const { field } = facet;
          console.log(field, "field")
          const tree = await this.facetedSearch({
            data: attendanceList,
            facets: [facet],
            sort,
          });

          if (!tree) {
            return APIResponse.error(
              response,
              apiId,
              'Invalid Sort Key',
              'BAD_REQUEST',
              HttpStatus.BAD_REQUEST,
            );
          }
          result[field] = tree[field];
        }

        // Return success response with counts
        // return new SuccessResponse({
        //   statusCode: HttpStatus.OK,
        //   message: 'Ok.',
        //   data: {
        //     result: result,
        //   },
        // });
        return APIResponse.success(
          response,
          apiId,
          {
            data: {
              result: result,
            },
          },
          HttpStatus.OK,
          'Ateendance List Fetched Successfully',
        );
      }
    } catch (error) {
      const errorMessage = error.message || 'Internal Server Error';
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

  async facetedSearch({ data, facets, sort }) {
    const tree = {};
    const attendanceKeys = new Set<string>();
    // Populate attendanceKeys with distinct attendance values
    data.forEach((item) => {
      const attendanceValue = item.attendance;
      if (attendanceValue) {
        attendanceKeys.add(attendanceValue);
      }
      //   if (item.attendanceDate) {
      //     attendanceKeys.add("attendanceDate");
      // }
    });

    // Iterate over facets
    for (const facet of facets) {
      const { field } = facet;

      // Initialize main facet in tree
      tree[field] = {};

      // Iterate over data to count occurrences of each field value
      for (const item of data) {
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
    Method to create,update or add attendance for valid user in attendance table
    @body an object of details consisting of attendance details of user (attendance dto)  
    @return updated details of attendance record 
    */

  public async updateAttendanceRecord(
    loginUserId: string| null,
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
        return APIResponse.success(
          res,
          apiId,
          { data: attendanceFound },
          HttpStatus.OK,
          'Attendance updated successfully',
        );
      } else {
        if (!attendanceDto.scope) {
          attendanceDto.scope = 'student';
        }
        attendanceDto.createdBy = loginUserId;
        attendanceDto.updatedBy = loginUserId;
        let attendanceCreated = await this.createAttendance(attendanceDto);
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

  /*Method to add multiple attendance records in Attendance table
    @body Array of objects containing attendance details of user (AttendanceDto)
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
          } else {
            results.push({ status: 'updated', attendance: attendanceRes });
          }
          count++;
        } catch (e) {
          errors.push({ attendance, error: e.message });
        }
      }
      if (errors.length > 0) {
        if (!results.length) {
          return APIResponse.error(
            res,
            apiId,
            'BAD_REQUEST',
            `Attendance Can not be created or updated.Error is ${errors[0].error}`,
            HttpStatus.BAD_REQUEST,
          );
        }
        return APIResponse.success(
          res,
          apiId,
          { count: count, errors: errors, successresults: results },
          HttpStatus.CREATED,
          'Bulk Attendance Processed with some errors',
        );
      } else {
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

// event , cohort