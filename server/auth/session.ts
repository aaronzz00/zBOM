import { randomUUID } from 'node:crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DbClient } from '../db/client';

export const SESSION_COOKIE_NAME = 'zbom_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export class AuthenticationError extends Error {
  statusCode = 401;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export const createSession = async (db: DbClient, userId: string) => {
  return db.session.create({
    data: {
      id: randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
};

export const setSessionCookie = (reply: FastifyReply, sessionId: string) => {
  reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
};

export const clearSessionCookie = (reply: FastifyReply) => {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
  });
};

export const readSessionId = (request: FastifyRequest): string => {
  const sessionId = request.cookies[SESSION_COOKIE_NAME];
  if (!sessionId) throw new AuthenticationError();
  return sessionId;
};

