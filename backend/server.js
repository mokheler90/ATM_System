import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = Number(process.env.PORT || 3001);
const demoMode = process.env.DEMO_MODE !== 'false';
const sessionTtlMs = 30 * 60 * 1000;
const sessions = new Map();
const cardHash = (number) => crypto.createHash('sha256').update(number).digest('hex');
const pinHash = (pin) => crypto.createHash('sha256').update(pin).digest('hex');
const now = () => new Date().toISOString();
const roundMoney = (amount) => Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
const atmId = 'ATM-001';

const demo = {
  accounts: [
    { id: 'acct-demo-1', account_number: '•••• 4821', customer_name: 'Jordan Lee', email: 'jordan@example.com', checking_balance: 2840.5, savings_balance: 6150 },
    { id: 'acct-demo-2', account_number: '•••• 1937', customer_name: 'Sam Rivera', email: 'sam@example.com', checking_balance: 1250, savings_balance: 3200 },
  ],
  cards: new Map([
    [cardHash('4000000000000002'), { account_id: 'acct-demo-1', pin_hash: pinHash('1234'), failed_attempts: 0, blocked: false, last4: '0002' }],
    [cardHash('4000000000000010'), { account_id: 'acct-demo-2', pin_hash: pinHash('5678'), failed_attempts: 0, blocked: false, last4: '0010' }],
  ]),
  transactions: [],
  atm: { id: atmId, cash_balance: 18750, paper_rolls: 8, cash_deposits_pending: 325, check_deposits_pending: 640, is_online: true, updated_at: now() },
};

let supabase;
if (!demoMode) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('DEMO_MODE=false requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '16kb' }));

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSession(role, accountId = null) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { role, accountId, expiresAt: Date.now() + sessionTtlMs });
  return token;
}

function requireSession(...roles) {
  return (req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    const session = token && sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      if (token) sessions.delete(token);
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    if (!roles.includes(session.role)) return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    session.expiresAt = Date.now() + sessionTtlMs;
    req.session = session;
    next();
  };
}

function fail(res, error) {
  console.error(error);
  const message = error?.message || 'The request could not be completed.';
  const status = /insufficient|not found|blocked|invalid|amount|cash|account|card|supplies|offline/i.test(message) ? 400 : 500;
  return res.status(status).json({ error: status === 500 ? 'A server error occurred. Please try again.' : message });
}

function accountView(account) {
  return {
    id: account.id,
    accountNumber: account.account_number,
    name: account.customer_name,
    email: account.email,
    checking: Number(account.checking_balance),
    savings: Number(account.savings_balance),
  };
}

function getDemoAccount(id) {
  const account = demo.accounts.find((item) => item.id === id);
  if (!account) throw new Error('Account not found.');
  return account;
}

function transactionView(tx) {
  return {
    id: tx.id,
    type: tx.type,
    accountType: tx.account_type,
    amount: Number(tx.amount),
    destinationAccountNumber: tx.destination_account_number || null,
    createdAt: tx.created_at,
    accountName: tx.account_name || '',
  };
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: demoMode ? 'demo' : 'supabase' }));

app.post('/api/auth/login', async (req, res) => {
  const cardNumber = String(req.body.cardNumber || '').replace(/\s/g, '');
  const pin = String(req.body.pin || '');
  if (!/^\d{12,19}$/.test(cardNumber) || !/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ error: 'Enter a valid card number and 4–8 digit PIN.' });
  }
  try {
    const digest = cardHash(cardNumber);
    let card;
    let account;
    if (demoMode) {
      card = demo.cards.get(digest);
      if (card) account = getDemoAccount(card.account_id);
    } else {
      const { data, error } = await supabase.rpc('authenticate_atm_card', { p_card_hash: digest, p_pin: pin });
      if (error) throw error;
      if (data.status === 'blocked') return res.status(423).json({ error: 'This card is locked. Please contact your bank.' });
      if (data.status !== 'ok') {
        return res.status(data.status === 'locked' ? 423 : 401).json({
          error: data.status === 'locked'
            ? 'Too many incorrect attempts. This card is now locked.'
            : data.status === 'incorrect'
              ? `Card number or PIN is incorrect. ${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? '' : 's'} remaining.`
              : 'Card number or PIN is incorrect.',
        });
      }
      account = data.account;
      const token = createSession('customer', account.id);
      return res.json({ token, account: accountView(account) });
    }
    if (!card) return res.status(401).json({ error: 'Card number or PIN is incorrect.' });
    if (card.blocked) return res.status(423).json({ error: 'This card is locked. Please contact your bank.' });
    const valid = safeEqual(pinHash(pin), card.pin_hash);
    if (!valid) {
      const attempts = Number(card.failed_attempts) + 1;
      if (demoMode) {
        card.failed_attempts = attempts;
        if (attempts >= 3) card.blocked = true;
      } else {
        const { error } = await supabase.from('cards').update({ failed_attempts: attempts, blocked: attempts >= 3 }).eq('id', card.id);
        if (error) throw error;
      }
      return res.status(attempts >= 3 ? 423 : 401).json({
        error: attempts >= 3 ? 'Too many incorrect attempts. This card is now locked.' : `Card number or PIN is incorrect. ${3 - attempts} attempt${3 - attempts === 1 ? '' : 's'} remaining.`,
      });
    }
    if (demoMode) card.failed_attempts = 0;
    else {
      const { error } = await supabase.from('cards').update({ failed_attempts: 0 }).eq('id', card.id);
      if (error) throw error;
    }
    const token = createSession('customer', account.id);
    res.json({ token, account: accountView(account) });
  } catch (error) { fail(res, error); }
});

app.post('/api/ops/login', (req, res) => {
  const role = req.body.role;
  const pin = String(req.body.pin || '');
  const expected = role === 'operator' ? process.env.OPERATOR_PIN || '2468' : role === 'manager' ? process.env.MANAGER_PIN || '8642' : '';
  if (!expected || !safeEqual(pin, expected)) return res.status(401).json({ error: 'The operations PIN is incorrect.' });
  res.json({ token: createSession(role), role });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/me', requireSession('customer'), async (req, res) => {
  try {
    if (demoMode) return res.json({ account: accountView(getDemoAccount(req.session.accountId)) });
    const { data, error } = await supabase.from('accounts').select('*').eq('id', req.session.accountId).single();
    if (error) throw error;
    res.json({ account: accountView(data) });
  } catch (error) { fail(res, error); }
});

app.get('/api/transactions', requireSession('customer'), async (req, res) => {
  try {
    if (demoMode) {
      const transactions = demo.transactions.filter((tx) => tx.account_id === req.session.accountId || tx.destination_account_number === getDemoAccount(req.session.accountId).account_number)
        .slice(0, 20).map(transactionView);
      return res.json({ transactions });
    }
    const { data, error } = await supabase.from('transactions').select('id, type, account_type, amount, destination_account_number, created_at')
      .eq('account_id', req.session.accountId).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    res.json({ transactions: data.map(transactionView) });
  } catch (error) { fail(res, error); }
});

app.post('/api/transactions', requireSession('customer'), async (req, res) => {
  const { type, accountType, amount, destinationAccountNumber } = req.body;
  const allowedTypes = ['balance_inquiry', 'withdrawal', 'deposit_cash', 'deposit_check', 'transfer'];
  const numericAmount = Number(amount);
  if (!allowedTypes.includes(type) || !['checking', 'savings'].includes(accountType)) return res.status(400).json({ error: 'Choose a valid transaction and account type.' });
  if (type !== 'balance_inquiry' && (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 10000)) {
    return res.status(400).json({ error: 'Enter an amount greater than $0 and no more than $10,000.' });
  }
  if (type === 'transfer' && (!/^\d{4,20}$/.test(String(destinationAccountNumber || '')))) {
    return res.status(400).json({ error: 'Enter a valid destination account number.' });
  }
  try {
    let tx;
    if (demoMode) {
      if (!demo.atm.is_online) throw new Error('This ATM is currently offline.');
      const source = getDemoAccount(req.session.accountId);
      const balanceKey = `${accountType}_balance`;
      const amt = type === 'balance_inquiry' ? 0 : roundMoney(numericAmount);
      if (type === 'withdrawal' || type === 'transfer') {
        if (Number(source[balanceKey]) < amt) throw new Error('Insufficient account balance.');
      }
      if (type === 'withdrawal' && demo.atm.cash_balance < amt) throw new Error('This ATM does not have enough cash for that withdrawal.');
      if (type === 'transfer') {
        const destination = demo.accounts.find((item) => item.account_number.replace(/\D/g, '') === String(destinationAccountNumber).replace(/\D/g, ''));
        if (!destination) throw new Error('Destination account was not found.');
        if (destination.id === source.id) throw new Error('You cannot transfer to the same account.');
        source[balanceKey] = roundMoney(source[balanceKey] - amt);
        destination.checking_balance = roundMoney(destination.checking_balance + amt);
      } else if (type === 'withdrawal') {
        source[balanceKey] = roundMoney(source[balanceKey] - amt);
        demo.atm.cash_balance = roundMoney(demo.atm.cash_balance - amt);
      } else if (type === 'deposit_cash' || type === 'deposit_check') {
        source[balanceKey] = roundMoney(source[balanceKey] + amt);
        const pendingKey = type === 'deposit_cash' ? 'cash_deposits_pending' : 'check_deposits_pending';
        demo.atm[pendingKey] = roundMoney(demo.atm[pendingKey] + amt);
      }
      tx = {
        id: crypto.randomUUID(), account_id: source.id, type, account_type: accountType, amount: amt,
        destination_account_number: type === 'transfer' ? destinationAccountNumber : null, created_at: now(),
      };
      demo.transactions.unshift(tx);
      if (demo.transactions.length > 200) demo.transactions.length = 200;
    } else {
      const { data, error } = await supabase.rpc('process_atm_transaction', {
        p_account_id: req.session.accountId,
        p_type: type,
        p_account_type: accountType,
        p_amount: type === 'balance_inquiry' ? 0 : roundMoney(numericAmount),
        p_destination_account_number: type === 'transfer' ? String(destinationAccountNumber) : null,
        p_atm_id: atmId,
      });
      if (error) throw error;
      tx = data;
    }
    let account;
    if (demoMode) account = getDemoAccount(req.session.accountId);
    else {
      const { data, error } = await supabase.from('accounts').select('*').eq('id', req.session.accountId).single();
      if (error) throw error;
      account = data;
    }
    res.json({ transaction: transactionView(tx), account: accountView(account) });
  } catch (error) { fail(res, error); }
});

app.get('/api/ops/dashboard', requireSession('operator', 'manager'), async (req, res) => {
  try {
    let atm;
    let transactions;
    if (demoMode) {
      atm = { ...demo.atm };
      transactions = demo.transactions.slice(0, 100).map((tx) => ({ ...transactionView(tx), accountName: demo.accounts.find((a) => a.id === tx.account_id)?.customer_name || '' }));
    } else {
      const [{ data: status, error: statusError }, { data: rows, error: txError }] = await Promise.all([
        supabase.from('atm_status').select('*').eq('id', atmId).single(),
        supabase.from('transactions').select('id, type, account_type, amount, destination_account_number, created_at, accounts(customer_name)').order('created_at', { ascending: false }).limit(100),
      ]);
      if (statusError) throw statusError;
      if (txError) throw txError;
      atm = status;
      transactions = rows.map((row) => ({ ...transactionView(row), accountName: row.accounts?.customer_name || '' }));
    }
    res.json({ atm, transactions, role: req.session.role });
  } catch (error) { fail(res, error); }
});

app.post('/api/ops/maintenance', requireSession('operator'), async (req, res) => {
  const cashAmount = Number(req.body.cashAmount || 0);
  const paperRolls = Number(req.body.paperRolls || 0);
  const collectDeposits = req.body.collectDeposits === true;
  const isOnline = typeof req.body.isOnline === 'boolean' ? req.body.isOnline : null;
  if (!Number.isFinite(cashAmount) || cashAmount < 0 || cashAmount > 100000 || !Number.isInteger(paperRolls) || paperRolls < 0 || paperRolls > 100) {
    return res.status(400).json({ error: 'Enter valid cash and printer-supply quantities.' });
  }
  if (cashAmount === 0 && paperRolls === 0 && !collectDeposits && isOnline === null) return res.status(400).json({ error: 'Choose at least one maintenance action.' });
  try {
    if (demoMode) {
      demo.atm.cash_balance = roundMoney(demo.atm.cash_balance + cashAmount);
      demo.atm.paper_rolls += paperRolls;
      if (collectDeposits) {
        demo.atm.cash_deposits_pending = 0;
        demo.atm.check_deposits_pending = 0;
      }
      if (isOnline !== null) demo.atm.is_online = isOnline;
      demo.atm.updated_at = now();
    } else {
      const { error } = await supabase.rpc('maintain_atm', {
        p_atm_id: atmId, p_cash_amount: roundMoney(cashAmount), p_paper_rolls: paperRolls,
        p_collect_deposits: collectDeposits, p_is_online: isOnline,
      });
      if (error) throw error;
    }
    const atm = demoMode ? demo.atm : (await supabase.from('atm_status').select('*').eq('id', atmId).single()).data;
    res.json({ atm, message: 'ATM supplies and deposit bag have been updated.' });
  } catch (error) { fail(res, error); }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get(/.*/, (_req, res) => res.sendFile('index.html', { root: 'dist' }));
}

app.listen(port, () => {
  console.log(`ATM API listening on http://localhost:${port} (${demoMode ? 'demo mode' : 'Supabase mode'})`);
});
