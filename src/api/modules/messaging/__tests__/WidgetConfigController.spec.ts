import { WidgetConfigController } from '../presentation/controllers/WidgetConfigController';
import { GetWidgetConfigUseCase } from '../application/use-cases/GetWidgetConfigUseCase';
import { UpdateWidgetConfigUseCase } from '../application/use-cases/UpdateWidgetConfigUseCase';
import { UploadWidgetAvatarUseCase } from '../application/use-cases/UploadWidgetAvatarUseCase';

describe('WidgetConfigController', () => {
  let controller: WidgetConfigController;
  let getConfig: jest.Mocked<Pick<GetWidgetConfigUseCase, 'execute'>>;
  let updateConfig: jest.Mocked<Pick<UpdateWidgetConfigUseCase, 'execute'>>;
  let uploadAvatar: jest.Mocked<Pick<UploadWidgetAvatarUseCase, 'execute'>>;

  beforeEach(() => {
    getConfig = { execute: jest.fn() };
    updateConfig = { execute: jest.fn() };
    uploadAvatar = { execute: jest.fn() };

    controller = new WidgetConfigController(
      getConfig as any,
      updateConfig as any,
      uploadAvatar as any,
    );
  });

  describe('get', () => {
    it('delegates to GetWidgetConfigUseCase with the path tenantId', async () => {
      getConfig.execute.mockResolvedValue({ id: 'cfg-1' } as any);

      const result = await controller.get('tenant-1');

      expect(getConfig.execute).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual({ id: 'cfg-1' });
    });
  });

  describe('update', () => {
    it('delegates to UpdateWidgetConfigUseCase with tenantId and dto', async () => {
      const dto = {
        collectName: true,
        collectPhone: false,
        collectEmail: false,
      };
      updateConfig.execute.mockResolvedValue({ id: 'cfg-1' } as any);

      await controller.update('tenant-1', dto as any);

      expect(updateConfig.execute).toHaveBeenCalledWith('tenant-1', dto);
    });
  });

  describe('avatar', () => {
    it('passes the buffer and mimetype from the uploaded file', async () => {
      uploadAvatar.execute.mockResolvedValue({ avatarUrl: 'https://cdn/a.png' });
      const file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/png',
      } as Express.Multer.File;

      const result = await controller.avatar('tenant-1', file);

      expect(uploadAvatar.execute).toHaveBeenCalledWith(
        'tenant-1',
        file.buffer,
        'image/png',
      );
      expect(result).toEqual({ avatarUrl: 'https://cdn/a.png' });
    });
  });
});
