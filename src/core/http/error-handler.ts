import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod'; 
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error.js';

export function errorHandler(
    error: FastifyError | Error,
    _request: FastifyRequest,
    reply: FastifyReply
) {
    if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
            statusCode: error.statusCode,
            code: error.code,
            message: error.message,
            details: error.details,
        });
    }

    if (error instanceof ZodError) {
        return reply.status(400).send({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: error.flatten(),
        });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            return reply.status(409).send({
                statusCode: 409,
                code: 'DUPLICATE_ENTRY',
                message: 'A record with this value already exists',
            });
        }

        if (error.code === 'P2025') {
            return reply.status(404).send({
                statusCode: 404,
                code: 'NOT_FOUND',
                message: 'Record not found',
            });
        }

        if (error.code === 'P2003') {
            return reply.status(400).send({
                statusCode: 400,
                code: 'INVALID_REFERENCE',
                message: 'Invalid reference to related record',
            });
        }
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
        reply.log.error(error, 'Database connection error');
        return reply.status(503).send({
            statusCode: 503,
            code: 'DATABASE_UNAVAILABLE',
            message: 'Database is currently unavailable',
        });
    }

    reply.log.error(error);

    return reply.status(500).send({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
    });
}