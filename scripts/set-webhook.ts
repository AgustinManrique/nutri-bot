// Registra el webhook de Telegram apuntando a tu deploy de Vercel.
// Uso: npm run webhook -- https://tu-proyecto.vercel.app
import { env } from '../lib/env';
import { tg } from '../lib/telegram';

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  if (!base?.startsWith('https://')) {
    console.error('Pasame la URL del deploy: npm run webhook -- https://tu-proyecto.vercel.app');
    process.exit(1);
  }
  await tg('setWebhook', {
    url: `${base}/api/telegram`,
    secret_token: env.webhookSecret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  await tg('setMyCommands', {
    commands: [
      { command: 'hoy', description: 'Cómo voy hoy' },
      { command: 'semana', description: 'Resumen de la semana' },
      { command: 'despensa', description: 'Qué tengo en casa' },
      { command: 'web', description: 'Vincular tu mail al dashboard' },
    ],
  });
  console.log('✅ Webhook configurado:', await tg('getWebhookInfo'));
}

main();
