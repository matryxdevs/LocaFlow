'use strict';

/**
 * Verifica a origem dos formulários sem presumir que APP_ORIGIN sempre
 * corresponde ao domínio público exibido pelo navegador (por exemplo,
 * domínio temporário/alternativo da Hostinger).
 *
 * O Host enviado ao backend identifica o destino da requisição no navegador;
 * Origin precisa corresponder a esse destino, ou a uma origem pública
 * explicitamente configurada. CSRF por token continua obrigatório.
 */
function parseOrigin(value) {
  if (typeof value !== 'string' || !/^https?:\/\/[^/?#\s]+$/i.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url;
  } catch { return null; }
}

function parseHost(value) {
  if (typeof value !== 'string' || !value || /[\s,/@#\\]/.test(value)) return null;
  try {
    const url = new URL(`https://${value}`);
    if (!url.hostname || url.username || url.password || url.pathname !== '/') return null;
    return url.host;
  } catch { return null; }
}

function allowedOrigin({ origin, host, forwardedHost, appOrigin, extraOrigins, production, trustProxy }) {
  // Ausência de Origin não significa ausência de CSRF: o token é conferido
  // por checkCsrf, independentemente deste middleware.
  if (origin === undefined || origin === null || origin === '') return true;
  const source = parseOrigin(origin);
  if (!source || (production && source.protocol !== 'https:')) return false;

  // Com APP_ORIGIN incorreto ou desatualizado, uma requisição genuinamente
  // same-origin continua válida. Em navegadores, Host aponta para o destino.
  const requestHost = parseHost(host);
  if (requestHost && source.host === requestHost) return true;

  // Somente atrás de proxy reverso CONFIÁVEL que substitua X-Forwarded-Host.
  const proxyHost = trustProxy ? parseHost(forwardedHost) : null;
  if (proxyHost && source.host === proxyHost) return true;

  // Permite o domínio canônico quando o proxy altera Host internamente.
  const explicit = [appOrigin, ...(Array.isArray(extraOrigins) ? extraOrigins : [])];
  return explicit.some((item) => {
    const target = parseOrigin(typeof item === 'string' ? item.trim().replace(/\/$/, '') : '');
    return Boolean(target && source.origin === target.origin);
  });
}

module.exports = { allowedOrigin, parseHost, parseOrigin };
