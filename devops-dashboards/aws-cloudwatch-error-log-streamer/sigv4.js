/* CloudTail — SigV4 request signing for AWS JSON APIs (CloudWatch Logs).
 * Pure WebCrypto, no dependencies. Shared by popup.js and background.js
 * (the service worker loads it via importScripts).
 * Credentials are only ever used here to sign requests bound for
 * logs.<region>.amazonaws.com — they are never transmitted anywhere else. */
'use strict';

/* global crypto, fetch */
const SigV4 = (() => {
  const enc = new TextEncoder();
  const toHex = (buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

  async function sha256Hex(data) {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    return toHex(await crypto.subtle.digest('SHA-256', bytes));
  }

  async function hmac(keyBytes, dataStr) {
    const key = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(dataStr)));
  }

  /**
   * Sign a CloudWatch Logs JSON API call.
   * Returns { url, headers } ready for fetch(url, { method: 'POST', headers, body: payload }).
   */
  async function signCloudWatch({ region, accessKeyId, secretAccessKey, sessionToken, target, payload }) {
    const service = 'logs';
    const host = `logs.${region}.amazonaws.com`;

    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
    const amzDate = `${dateStamp}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

    // Canonical headers: lowercase, sorted, trimmed values.
    const headers = {
      'content-type': 'application/x-amz-json-1.1',
      host,
      'x-amz-date': amzDate,
      'x-amz-target': target,
    };
    if (sessionToken) headers['x-amz-security-token'] = sessionToken;

    const sortedKeys = Object.keys(headers).sort();
    const signedHeaders = sortedKeys.join(';');
    const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k].trim()}\n`).join('');
    const payloadHash = await sha256Hex(payload);
    const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');

    const kDate = await hmac(enc.encode('AWS4' + secretAccessKey), dateStamp);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    const kSigning = await hmac(kService, 'aws4_request');
    const signature = toHex(await hmac(kSigning, stringToSign));

    const outHeaders = {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Date': amzDate,
      'X-Amz-Target': target,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    if (sessionToken) outHeaders['X-Amz-Security-Token'] = sessionToken;

    return { url: `https://${host}/`, headers: outHeaders };
  }

  /** Sign + POST a CloudWatch Logs action. Throws a friendly Error on failure. */
  async function callCloudWatch(creds, target, bodyObj) {
    const payload = JSON.stringify(bodyObj); // hashed and sent as the exact same string
    const { url, headers } = await signCloudWatch({ ...creds, target, payload });
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers, body: payload });
    } catch {
      throw new Error(`Network error — could not reach logs.${creds.region}.amazonaws.com.`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const type = String(data.__type || '').split('#').pop();
      const msg = data.message || data.Message || `HTTP ${res.status}`;
      if (type === 'UnrecognizedClientException')
        throw new Error('Invalid credentials — check the access key ID and secret.');
      if (type === 'InvalidSignatureException')
        throw new Error('Signature rejected — check the secret key, region, and this device\u2019s clock.');
      if (type === 'AccessDeniedException')
        throw new Error('Access denied — the IAM key needs logs:DescribeLogGroups and logs:FilterLogEvents.');
      if (type === 'InvalidParameterException') throw new Error(`Invalid parameter — ${msg}`);
      throw new Error(msg);
    }
    return data;
  }

  return { signCloudWatch, callCloudWatch, sha256Hex };
})();
