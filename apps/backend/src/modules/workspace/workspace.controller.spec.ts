import { BadRequestException } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import type { WorkspaceService } from './workspace.service';

const USER = { id: 'user_1' };
const ORG = 'org_1';

function build() {
  const service = {
    get: jest.fn(async () => ({ id: 'ws' })),
    put: jest.fn(async () => ({ id: 'ws' })),
    reset: jest.fn(async () => null),
    createLayout: jest.fn(async () => ({ id: 'ws' })),
    updateLayout: jest.fn(async () => ({ id: 'ws' })),
    deleteLayout: jest.fn(async () => undefined),
    duplicateLayout: jest.fn(async () => ({ id: 'ws' })),
  };
  const controller = new WorkspaceController(
    service as unknown as WorkspaceService,
  );
  return { controller, service };
}

describe('WorkspaceController', () => {
  it('returns the workspace wrapped for the requesting org/user', async () => {
    const { controller, service } = build();

    await expect(controller.get(ORG, USER)).resolves.toEqual({
      workspace: { id: 'ws' },
    });
    expect(service.get).toHaveBeenCalledWith(ORG, USER.id);
  });

  it('unwraps { workspace } or accepts a bare workspace body', async () => {
    const { controller, service } = build();
    const payload = { schemaVersion: 1 };

    await controller.put(ORG, USER, { workspace: payload });
    await controller.put(ORG, USER, payload);

    expect(service.put).toHaveBeenNthCalledWith(1, ORG, USER.id, payload);
    expect(service.put).toHaveBeenNthCalledWith(2, ORG, USER.id, payload);
  });

  it('defaults reset scope to layout and rejects an unknown scope', async () => {
    const { controller, service } = build();

    await controller.reset(ORG, USER, undefined);
    await controller.reset(ORG, USER, { scope: 'all' });

    expect(service.reset).toHaveBeenNthCalledWith(1, ORG, USER.id, 'layout');
    expect(service.reset).toHaveBeenNthCalledWith(2, ORG, USER.id, 'all');

    await expect(
      controller.reset(ORG, USER, { scope: 'everything' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes layout CRUD through with the org and user', async () => {
    const { controller, service } = build();

    await controller.createLayout(ORG, USER, { name: 'Ops' });
    await controller.updateLayout('layout_1', ORG, USER, { name: 'Renamed' });
    await controller.deleteLayout('layout_1', ORG, USER);
    await controller.duplicateLayout('layout_1', ORG, USER);

    expect(service.createLayout).toHaveBeenCalledWith(ORG, USER.id, { name: 'Ops' });
    expect(service.updateLayout).toHaveBeenCalledWith(
      ORG,
      USER.id,
      'layout_1',
      { name: 'Renamed' },
    );
    expect(service.deleteLayout).toHaveBeenCalledWith(ORG, USER.id, 'layout_1');
    expect(service.duplicateLayout).toHaveBeenCalledWith(ORG, USER.id, 'layout_1');
  });
});
