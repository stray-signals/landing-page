// ── App registry ──────────────────────────────────────────────────
// Apps are windows that also have a full page.

export const APPS = {
  qr: {
    id: 'qr',
    windowId: 'win-qr',
    title: 'qr',
    pageUrl: '/tools/qr/',
    description: 'make a qr code',
    mount: (bodyEl) => import('/tools/qr/qr.tool.js').then(m => m.mountQrTool(bodyEl, { mode: 'window' })),
  },
};
