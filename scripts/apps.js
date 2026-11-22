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
  palette: {
    id: 'palette',
    windowId: 'win-palette',
    title: 'palette',
    pageUrl: '/tools/palette/',
    description: 'make a color palette',
    mount: (bodyEl) => import('/tools/palette/palette.tool.js').then(m => m.mountPaletteTool(bodyEl, { mode: 'window' })),
  },
};
