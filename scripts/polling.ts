// Modo desarrollo: corre el bot en tu compu con long polling (sin deploy ni webhook).
// Uso: npm run dev
import { procesarUpdate } from '../lib/bot';
import { tg, type TgUpdate } from '../lib/telegram';

async function main() {
  await tg('deleteWebhook', { drop_pending_updates: false });
  console.log('🤖 Bot escuchando en modo polling (Ctrl+C para cortar)…');
  let offset = 0;
  for (;;) {
    try {
      const updates = await tg<TgUpdate[]>('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        await procesarUpdate(u).catch((e) => console.error(e));
      }
    } catch (e) {
      console.error('[polling]', e);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
