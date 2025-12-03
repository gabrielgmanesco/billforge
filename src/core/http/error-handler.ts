import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod'; 
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

    reply.log.error(error);

    return reply.status(500).send({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
    });
}