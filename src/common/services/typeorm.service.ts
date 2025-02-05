import { Injectable } from '@nestjs/common';
import {
    DeepPartial,
    DeleteResult,
    EntityManager,
    EntityTarget,
    InsertResult,
    Repository,
    UpdateResult,
} from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class TypeormService {
    constructor(
        @InjectEntityManager() private readonly entityManager: EntityManager,
    ) { }

    // Get repository for a specific entity
    private getRepository<T>(entity: EntityTarget<T>): Repository<T> {
        return this.entityManager.getRepository(entity);
    }

    // Find all records with optional conditions
    async find<T>(entity: EntityTarget<T>, options?: object): Promise<T[]> {
        return await this.getRepository(entity).find(options);
    }

    // Find one record by conditions
    async findOne<T>(entity: EntityTarget<T>, conditions: object): Promise<T> {
        const record = await this.getRepository(entity).findOne(conditions);
        return record;
    }

    // Save a new entity or update existing
    async save<T>(entity: EntityTarget<T>, data: Partial<T>): Promise<T> {
        return await this.getRepository(entity).save(data as DeepPartial<T>);
    }

    // Update an existing entity by ID
    async update<T>(
        entity: EntityTarget<T>,
        criteria: any,
        partialEntity: QueryDeepPartialEntity<T>,
    ): Promise<UpdateResult> {
        const repository = this.getRepository(entity);
        return await repository.update(criteria, partialEntity);
    }

    // Delete an entity by ID
    async delete<T>(
        entity: EntityTarget<T>,
        id: string | string[] | object,
    ): Promise<DeleteResult> {
        const repository = this.getRepository(entity);
        return repository.delete(id);
    }

    // Execute a raw query
    async query<T>(query: string, parameters?: any[]): Promise<any> {
        return await this.entityManager.query(query, parameters);
    }

    async queryWithBuilder<T>(
        entity: EntityTarget<T>,
        alias: string,
        callback: (qb: any) => any,
    ): Promise<T[]> {
        const repository = this.getRepository(entity);

        // Create a query builder
        const queryBuilder = repository.createQueryBuilder(alias);

        // Apply custom query modifications using the callback
        callback(queryBuilder);

        // Execute and return results
        return await queryBuilder.getMany();
    }

    async insert<T>(
        entity: EntityTarget<T>,
        values: QueryDeepPartialEntity<T>[],
        returningFields: string[] = [],
    ): Promise<InsertResult> {
        const repository = this.getRepository(entity);

        const queryBuilder = repository
            .createQueryBuilder()
            .insert()
            .into(entity)
            .values(values);

        if (returningFields.length) {
            queryBuilder.returning(returningFields);
        }

        return await queryBuilder.execute();
    }

    create<T>(entity: EntityTarget<T>, entityLike: DeepPartial<T>): T {
        const repository = this.getRepository(entity);
        return repository.create(entityLike);
    }

    getMetadata<T>(entity: EntityTarget<T>): import("typeorm").EntityMetadata {
        const repository = this.getRepository(entity);
        return repository.metadata;
    }

    merge<T>(entity: EntityTarget<T>, mergeIntoEntity: T, ...entityLikes: DeepPartial<T>[]): T {
        const repository = this.getRepository(entity);
        return repository.merge(mergeIntoEntity, ...entityLikes);
    }
}
