/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 读取存储类型环境变量，默认 localstorage
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | 'kvrocks'
    | undefined) || 'localstorage';

// 生成签名
async function generateSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  // 导入密钥
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 生成签名
  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 生成认证Cookie（带签名）
async function generateAuthCookie(
  username?: string,
  password?: string,
  role?: 'owner' | 'admin' | 'user',
  includePassword = false
): Promise<string> {
  const authData: any = { role: role || 'user' };

  // 只在需要时包含 password
  if (includePassword && password) {
    authData.password = password;
  }

  if (username && process.env.PASSWORD) {
    authData.username = username;
    // 使用密码作为密钥对用户名进行签名
    const signature = await generateSignature(username, process.env.PASSWORD);
    authData.signature = signature;
    authData.timestamp = Date.now(); // 添加时间戳防重放攻击
  }

  return encodeURIComponent(JSON.stringify(authData));
}

// Only local paths may be used after successful native-form login.
function safeRelativeRedirect(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('\r') ||
    value.includes('\n')
  ) {
    return '/';
  }
  return value;
}

export async function POST(req: NextRequest) {
  const isNativeForm =
    (req.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase() === 'application/x-www-form-urlencoded';
  let redirectPath = '/';

  // JSON login retains its existing contract. Native forms work without React.
  const respond = (
    data: { ok?: boolean; error?: string },
    init?: { status?: number }
  ) => {
    const status = init?.status ?? 200;
    if (!isNativeForm) return NextResponse.json(data, init);

    if (status >= 400) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('error', data.error || '登录失败');
      if (redirectPath !== '/') loginUrl.searchParams.set('redirect', redirectPath);
      return NextResponse.redirect(loginUrl, { status: 303 });
    }

    return NextResponse.redirect(new URL(redirectPath, req.url), {
      status: 303,
    });
  };

  try {
    let credentials: any;
    if (isNativeForm) {
      const form = await req.formData();
      credentials = {
        username: form.get('username'),
        password: form.get('password'),
        redirect: form.get('redirect'),
      };
    } else {
      credentials = await req.json();
    }
    redirectPath = safeRelativeRedirect(credentials?.redirect);
    // 本地 / localStorage 模式——仅校验固定密码
    if (STORAGE_TYPE === 'localstorage') {
      const envPassword = process.env.PASSWORD;

      // 未配置 PASSWORD 时直接放行
      if (!envPassword) {
        const response = respond({ ok: true });

        // 清除可能存在的认证cookie
        response.cookies.set('auth', '', {
          path: '/',
          expires: new Date(0),
          sameSite: 'lax', // 改为 lax 以支持 PWA
          httpOnly: false, // PWA 需要客户端可访问
          secure: false, // 根据协议自动设置
        });

        return response;
      }

      const { password } = credentials;
      if (typeof password !== 'string') {
        return respond({ error: '密码不能为空' }, { status: 400 });
      }

      if (password !== envPassword) {
        return respond(
          { ok: false, error: '密码错误' },
          { status: 401 }
        );
      }

      // 验证成功，设置认证cookie
      const response = respond({ ok: true });
      const cookieValue = await generateAuthCookie(
        undefined,
        password,
        'user',
        true
      ); // localstorage 模式包含 password
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天过期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改为 lax 以支持 PWA
        httpOnly: false, // PWA 需要客户端可访问
        secure: false, // 根据协议自动设置
      });

      return response;
    }

    // 数据库 / redis 模式——校验用户名并尝试连接数据库
    const { username, password } = credentials;

    if (!username || typeof username !== 'string') {
      return respond({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return respond({ error: '密码不能为空' }, { status: 400 });
    }

    // 可能是站长，直接读环境变量
    if (
      username === process.env.USERNAME &&
      password === process.env.PASSWORD
    ) {
      // 验证成功，设置认证cookie
      const response = respond({ ok: true });
      const cookieValue = await generateAuthCookie(
        username,
        password,
        'owner',
        false
      ); // 数据库模式不包含 password
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天过期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改为 lax 以支持 PWA
        httpOnly: false, // PWA 需要客户端可访问
        secure: false, // 根据协议自动设置
      });

      return response;
    } else if (username === process.env.USERNAME) {
      return respond({ error: '用户名或密码错误' }, { status: 401 });
    }

    const config = await getConfig();
    const user = config.UserConfig.Users.find((u) => u.username === username);
    if (user && user.banned) {
      return respond({ error: '用户被封禁' }, { status: 401 });
    }

    // 校验用户密码
    try {
      const pass = await db.verifyUser(username, password);
      if (!pass) {
        return respond(
          { error: '用户名或密码错误' },
          { status: 401 }
        );
      }

      // 验证成功，设置认证cookie
      const response = respond({ ok: true });
      const cookieValue = await generateAuthCookie(
        username,
        password,
        user?.role || 'user',
        false
      ); // 数据库模式不包含 password
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天过期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改为 lax 以支持 PWA
        httpOnly: false, // PWA 需要客户端可访问
        secure: false, // 根据协议自动设置
      });

      return response;
    } catch (err) {
      console.error('数据库验证失败', err);
      return respond({ error: '数据库错误' }, { status: 500 });
    }
  } catch (error) {
    console.error('登录接口异常', error);
    return respond({ error: '服务器错误' }, { status: 500 });
  }
}
