import { WidgetScriptController } from '../presentation/controllers/WidgetScriptController';
import { Response } from 'express';

describe('WidgetScriptController', () => {
  let controller: WidgetScriptController;
  let res: jest.Mocked<Pick<Response, 'setHeader' | 'send'>>;

  beforeEach(() => {
    controller = new WidgetScriptController();
    res = {
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  it('serves the script as JavaScript', () => {
    controller.serveScript(res as unknown as Response);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/javascript; charset=utf-8',
    );
  });

  it('allows any origin so the script embeds cross-site', () => {
    controller.serveScript(res as unknown as Response);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      '*',
    );
  });

  it('sets a public cache header', () => {
    controller.serveScript(res as unknown as Response);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=300',
    );
  });

  it('sends a non-empty IIFE body that talks to the widget endpoints', () => {
    controller.serveScript(res as unknown as Response);

    const body = res.send.mock.calls[0][0] as string;
    expect(typeof body).toBe('string');
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain("'/widget/'");
    expect(body).toContain('data-token');
  });
});
