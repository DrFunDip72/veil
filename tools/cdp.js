/* Minimal Chrome DevTools Protocol client, shared by the build tools.
 * Chrome must already be listening on --remote-debugging-port=9222.
 */
let msgId = 0;

function send(ws, method, params, timeoutMs) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params: params || {} }));
  return new Promise((resolve, reject) => {
    const onMsg = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id !== id) return;
      ws.removeEventListener('message', onMsg);
      m.error ? reject(new Error(method + ': ' + JSON.stringify(m.error))) : resolve(m.result);
    };
    ws.addEventListener('message', onMsg);
    setTimeout(() => reject(new Error(method + ' timed out')), timeoutMs || 30000);
  });
}

async function evaluate(ws, expression, timeoutMs) {
  const res = await send(ws, 'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (res.exceptionDetails) {
    const d = res.exceptionDetails;
    throw new Error('page error: ' + (d.exception ? d.exception.description : d.text));
  }
  return res.result.value;
}

async function connect(port = 9222) {
  const list = await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json());
  const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('no debuggable page — start Chrome with --remote-debugging-port=' + port);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');
  return ws;
}

function navigate(ws, url, settleMs = 15000) {
  return new Promise(async resolve => {
    const onMsg = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); resolve(); }
    };
    ws.addEventListener('message', onMsg);
    await send(ws, 'Page.navigate', { url });
    setTimeout(resolve, settleMs);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = { send, evaluate, connect, navigate, sleep };
