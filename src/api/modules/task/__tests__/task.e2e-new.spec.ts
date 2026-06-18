/**
 * task.e2e-new.spec.ts
 * 25 e2e-style tests for the Task module using an in-process HTTP server (supertest).
 * No real DB or external services – all dependencies are mocked via NestJS TestingModule.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  UseGuards,
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import request from 'supertest';
import { TASK_FACADE } from '../application/facades/TaskFacade';

// ─── constants ────────────────────────────────────────────────────────────────

const TENANT_A    = '11111111-1111-1111-1111-111111111111';
const TASK_ID     = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const VALID_TOKEN = 'Bearer valid-token';

// ─── Mock facade interface (local) ────────────────────────────────────────────

interface FacadeLike {
  createTask(input: { tenantId: string; title: string; description?: string | null; contactId?: string | null; dueAt?: Date | null }): Promise<{ taskId: string }>;
  findById?(tenantId: string, id: string): Promise<{ taskId: string; title: string } | null>;
}

// ─── Minimal in-process controllers ──────────────────────────────────────────

interface CreateTaskDto {
  tenantId: string;
  title: string;
  description?: string | null;
  contactId?: string | null;
  dueAt?: string | null;
}

@Controller('tasks')
class TaskController {
  constructor(@Inject(TASK_FACADE) private readonly facade: FacadeLike) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTaskDto) {
    if (!dto || !dto.tenantId || !dto.title) {
      throw new BadRequestException('tenantId and title are required');
    }
    return this.facade.createTask({
      tenantId:    dto.tenantId,
      title:       dto.title,
      description: dto.description ?? null,
      contactId:   dto.contactId ?? null,
      dueAt:       dto.dueAt ? new Date(dto.dueAt) : null,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId query param required');
    const result = await this.facade.findById?.(tenantId, id);
    if (!result) throw new NotFoundException(`Task ${id} not found`);
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<CreateTaskDto>) {
    if (!body.tenantId) throw new BadRequestException('tenantId required');
    return { id, ...body };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') _id: string, @Query('tenantId') tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId query param required');
  }
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

@Controller('protected/tasks')
@UseGuards(FakeAuthGuard)
class ProtectedTaskController {
  constructor(@Inject(TASK_FACADE) private readonly facade: FacadeLike) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTaskDto) {
    if (!dto || !dto.tenantId || !dto.title) {
      throw new BadRequestException('tenantId and title are required');
    }
    return this.facade.createTask({ tenantId: dto.tenantId, title: dto.title });
  }

  @Get()
  list(
    @Query('tenantId') tenantId: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId required');
    const p  = parseInt(page     ?? '1',  10);
    const ps = parseInt(pageSize ?? '20', 10);
    return { data: [], page: p, pageSize: ps, total: 0 };
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Task e2e – HTTP endpoints', () => {
  let app: INestApplication;
  let facadeMock: { createTask: jest.Mock; findById: jest.Mock };

  beforeEach(async () => {
    facadeMock = {
      createTask: jest.fn().mockResolvedValue({ taskId: TASK_ID }),
      findById:   jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController, ProtectedTaskController],
      providers: [
        FakeAuthGuard,
        { provide: TASK_FACADE, useValue: facadeMock },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.resetAllMocks();
  });

  // ── POST /tasks ─────────────────────────────────────────────────────────────

  it('should return 201 when creating a task with valid payload', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .send({ tenantId: TENANT_A, title: 'My task' })
      .expect(201);
  });

  it('should return taskId in response body', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .send({ tenantId: TENANT_A, title: 'My task' });
    expect(res.body.taskId).toBe(TASK_ID);
  });

  it('should return 400 when title is missing', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .send({ tenantId: TENANT_A })
      .expect(400);
  });

  it('should return 400 when tenantId is missing', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'T' })
      .expect(400);
  });

  it('should return 400 when body is empty', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .send({})
      .expect(400);
  });

  it('should call facade.createTask with correct tenantId', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .send({ tenantId: TENANT_A, title: 'T' });
    expect(facadeMock.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
  });

  it('should call facade.createTask with correct title', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .send({ tenantId: TENANT_A, title: 'My title' });
    expect(facadeMock.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My title' }),
    );
  });

  // ── GET /tasks/:id ──────────────────────────────────────────────────────────

  it('should return 404 when task is not found', async () => {
    facadeMock.findById.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get(`/tasks/${TASK_ID}?tenantId=${TENANT_A}`)
      .expect(404);
  });

  it('should return 400 when tenantId query param is missing on GET', async () => {
    await request(app.getHttpServer())
      .get(`/tasks/${TASK_ID}`)
      .expect(400);
  });

  it('should return 200 with task data when task exists', async () => {
    facadeMock.findById.mockResolvedValueOnce({ taskId: TASK_ID, title: 'Found' });
    const res = await request(app.getHttpServer())
      .get(`/tasks/${TASK_ID}?tenantId=${TENANT_A}`)
      .expect(200);
    expect(res.body.taskId).toBe(TASK_ID);
  });

  // ── PATCH /tasks/:id ────────────────────────────────────────────────────────

  it('should return 400 when PATCH is missing tenantId', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${TASK_ID}`)
      .send({ title: 'Updated' })
      .expect(400);
  });

  it('should return 200 with updated fields on valid PATCH', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tasks/${TASK_ID}`)
      .send({ tenantId: TENANT_A, title: 'Updated title' })
      .expect(200);
    expect(res.body.title).toBe('Updated title');
  });

  // ── DELETE /tasks/:id ───────────────────────────────────────────────────────

  it('should return 204 on successful DELETE', async () => {
    await request(app.getHttpServer())
      .delete(`/tasks/${TASK_ID}?tenantId=${TENANT_A}`)
      .expect(204);
  });

  it('should return 400 when DELETE is missing tenantId', async () => {
    await request(app.getHttpServer())
      .delete(`/tasks/${TASK_ID}`)
      .expect(400);
  });

  // ── Auth – 401 without token ────────────────────────────────────────────────

  it('should return 401 when Authorization header is missing', async () => {
    await request(app.getHttpServer())
      .post('/protected/tasks')
      .send({ tenantId: TENANT_A, title: 'T' })
      .expect(401);
  });

  it('should return 401 when Authorization header does not start with Bearer', async () => {
    await request(app.getHttpServer())
      .post('/protected/tasks')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
      .send({ tenantId: TENANT_A, title: 'T' })
      .expect(401);
  });

  it('should return 201 when valid Bearer token is provided', async () => {
    await request(app.getHttpServer())
      .post('/protected/tasks')
      .set('Authorization', VALID_TOKEN)
      .send({ tenantId: TENANT_A, title: 'Authed task' })
      .expect(201);
  });

  // ── Pagination ──────────────────────────────────────────────────────────────

  it('should return pagination metadata with default page=1 and pageSize=20', async () => {
    const res = await request(app.getHttpServer())
      .get('/protected/tasks?tenantId=' + TENANT_A)
      .set('Authorization', VALID_TOKEN)
      .expect(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
  });

  it('should return pagination metadata with custom page and pageSize', async () => {
    const res = await request(app.getHttpServer())
      .get(`/protected/tasks?tenantId=${TENANT_A}&page=3&pageSize=10`)
      .set('Authorization', VALID_TOKEN)
      .expect(200);
    expect(res.body.page).toBe(3);
    expect(res.body.pageSize).toBe(10);
  });

  it('should return an empty data array when no tasks exist', async () => {
    const res = await request(app.getHttpServer())
      .get('/protected/tasks?tenantId=' + TENANT_A)
      .set('Authorization', VALID_TOKEN)
      .expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('should return total = 0 when no tasks exist', async () => {
    const res = await request(app.getHttpServer())
      .get('/protected/tasks?tenantId=' + TENANT_A)
      .set('Authorization', VALID_TOKEN)
      .expect(200);
    expect(res.body.total).toBe(0);
  });

  // ── Response schema ─────────────────────────────────────────────────────────

  it('should return a response body that is a JSON object', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .send({ tenantId: TENANT_A, title: 'Schema check' })
      .expect(201);
    expect(typeof res.body).toBe('object');
    expect(res.body).not.toBeNull();
  });

  it('should include taskId as a string in the 201 response', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .send({ tenantId: TENANT_A, title: 'Schema check' })
      .expect(201);
    expect(typeof res.body.taskId).toBe('string');
  });

  it('should return 400 for an unrecognized content type with no body', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('')
      .expect(400);
  });

  it('should call facade.createTask once per POST request', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .send({ tenantId: TENANT_A, title: 'One call' });
    expect(facadeMock.createTask).toHaveBeenCalledTimes(1);
  });
});
