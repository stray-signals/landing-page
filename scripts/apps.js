// app registry
// Apps are windows that also have a full page.
// folder: which terminal directory lists it (default 'tools').

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
  pixel: {
    id: 'pixel',
    windowId: 'win-pixel',
    title: 'pixel',
    pageUrl: '/tools/pixel/',
    description: 'draw pixel art',
    mount: (bodyEl) => import('/tools/pixel/pixel.tool.js').then(m => m.mountPixelTool(bodyEl, { mode: 'window' })),
  },
  arcade: {
    id: 'arcade',
    windowId: 'win-arcade',
    title: 'arcade',
    pageUrl: '/tools/arcade/',
    description: 'play a game',
    mount: (bodyEl) => import('/tools/arcade/arcade.tool.js').then(m => m.mountArcade(bodyEl, { mode: 'window' })),
  },
  transmissions: {
    id: 'transmissions',
    windowId: 'win-transmissions',
    title: 'transmissions',
    pageUrl: '/transmissions/',
    description: "read stray's log",
    mount: (bodyEl) => import('/tools/transmissions/transmissions.tool.js').then(m => m.mountTransmissions(bodyEl)),
  },
  aurora: {
    id: 'aurora',
    folder: 'art',
    windowId: 'win-aurora',
    title: 'aurora',
    pageUrl: '/art/aurora/',
    description: 'northern lights over a lake',
    mount: (bodyEl) => import('/art/aurora/aurora.art.js').then(m => m.mountAurora(bodyEl, { mode: 'window' })),
  },
};
