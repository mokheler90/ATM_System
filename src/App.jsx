import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Check, ChevronDown, CircleHelp,
  Clock3, CreditCard, FileText, KeyRound, Landmark, LockKeyhole, LogOut, Plus,
  Printer, ReceiptText, RefreshCw, ShieldCheck, Wallet, X,
} from 'lucide-react';

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const txLabels = {
  balance_inquiry: 'Balance inquiry',
  withdrawal: 'Cash withdrawal',
  deposit_cash: 'Cash deposit',
  deposit_check: 'Check deposit',
  transfer: 'Fund transfer',
};
const txIcons = {
  balance_inquiry: CircleHelp,
  withdrawal: ArrowUpRight,
  deposit_cash: ArrowDownLeft,
  deposit_check: FileText,
  transfer: ArrowLeftRight,
};

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function Brand({ compact = false }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}><span className="brand-mark"><Landmark size={20} strokeWidth={2.2} /></span><span>northstar<span className="brand-dot">.</span></span></div>;
}

function Header({ mode, onMode, onLogout, signedIn, demoMode }) {
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar-right">
        <span className="secure-label"><span className="status-dot" /> {demoMode ? 'DEMO ENVIRONMENT' : 'SECURE CONNECTION'}</span>
        {!signedIn ? (
          <div className="mode-switch" aria-label="Choose access type">
            <button className={mode === 'customer' ? 'selected' : ''} onClick={() => onMode('customer')}>Customer</button>
            <button className={mode === 'operations' ? 'selected' : ''} onClick={() => onMode('operations')}>Operations</button>
          </div>
        ) : (
          <button className="icon-button" aria-label="Sign out" onClick={onLogout}><LogOut size={18} /><span className="signout-label">Sign out</span></button>
        )}
      </div>
    </header>
  );
}

function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

function Alert({ children, onClose }) {
  if (!children) return null;
  return <div className="alert" role="alert"><span>{children}</span><button aria-label="Dismiss" onClick={onClose}><X size={16} /></button></div>;
}

function CustomerLogin({ onLogin, busy, error, clearError }) {
  const [cardNumber, setCardNumber] = useState('');
  const [pin, setPin] = useState('');
  const submit = (event) => {
    event.preventDefault();
    onLogin({ cardNumber: cardNumber.replace(/\s/g, ''), pin });
  };
  return (
    <main className="login-layout">
      <section className="welcome-panel">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR MONEY, IN GOOD HANDS</div>
        <h1>Banking that<br />moves <em>with you.</em></h1>
        <p>Access your accounts, move money and take care of the little things — all from one thoughtful place.</p>
        <div className="welcome-perks">
          <span><ShieldCheck size={17} /> Protected access</span>
          <span><Clock3 size={17} /> Available around the clock</span>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-glow" /><div className="art-card"><div className="art-card-top"><span>NORTHSTAR</span><Landmark size={17} /></div><div className="art-chip" /><div className="art-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;4821</div><div className="art-card-bottom"><span>JORDAN LEE</span><span>VISA</span></div></div>
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <span className="art-caption">A little more in your corner.</span>
        </div>
      </section>
      <section className="login-card">
        <div className="login-card-heading"><span className="section-icon"><CreditCard size={19} /></span><div><h2>Welcome back</h2><p>Insert your card details to get started.</p></div></div>
        <Alert onClose={clearError}>{error}</Alert>
        <form onSubmit={submit} className="login-form">
          <Field label="Card number" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/[^\d ]/g, ''))} placeholder="4000 0000 0000 0002" inputMode="numeric" autoComplete="cc-number" required />
          <Field label="Personal identification number" type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Enter your PIN" inputMode="numeric" autoComplete="current-password" required />
          <div className="form-note"><LockKeyhole size={14} /> Your details are encrypted and secure.</div>
          <button className="primary-button wide" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Checking card</> : <>Continue <ArrowUpRight size={17} /></>}</button>
        </form>
        <div className="demo-hint"><div className="demo-hint-title"><span className="demo-dot" /> Demo card details</div><div><span>Card</span><code>4000 0000 0000 0002</code><button onClick={() => { setCardNumber('4000000000000002'); setPin('1234'); clearError(); }}>Use demo</button></div><div><span>PIN</span><code>1234</code><span className="hint-right">3 tries before card lock</span></div></div>
        <div className="login-help">Need a hand? <a href="mailto:support@northstar.example">Talk to our support team</a></div>
      </section>
    </main>
  );
}

function OpsLogin({ onLogin, busy, error, clearError }) {
  const [role, setRole] = useState('manager');
  const [pin, setPin] = useState('');
  return (
    <main className="ops-login-wrap">
      <div className="ops-intro"><span className="eyebrow"><span className="eyebrow-line" /> NORTHSTAR ATM NETWORK</span><h1>Operations,<br /><em>in view.</em></h1><p>Keep the network running smoothly with clear, real-time visibility into every ATM.</p><div className="ops-visual"><div className="ops-visual-head"><span className="mini-logo"><Landmark size={15} /></span><span>ATM-001</span><span className="ops-live"><i /> ONLINE</span></div><div className="ops-visual-screen"><span>AVAILABLE CASH</span><strong>$18,750.00</strong><div><span /><span /><span /><span /><span /><span /><span /><span /></div></div><div className="ops-visual-bottom"><span><Banknote size={14} /> Cash dispenser</span><span><Printer size={14} /> Receipt printer</span></div></div></div>
      <section className="ops-login-card">
        <div className="login-card-heading"><span className="section-icon"><KeyRound size={18} /></span><div><h2>Team sign in</h2><p>Authorized personnel only.</p></div></div>
        <Alert onClose={clearError}>{error}</Alert>
        <div className="role-picker"><button className={role === 'manager' ? 'active' : ''} onClick={() => setRole('manager')}><Landmark size={17} /><span>Bank manager</span><small>Reports & cash levels</small></button><button className={role === 'operator' ? 'active' : ''} onClick={() => setRole('operator')}><RefreshCw size={17} /><span>ATM operator</span><small>Cash & printer supplies</small></button></div>
        <form onSubmit={(e) => { e.preventDefault(); onLogin({ role, pin }); }} className="login-form"><Field label="Operations PIN" value={pin} type="password" onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Enter your secure PIN" inputMode="numeric" required /><div className="form-note"><LockKeyhole size={14} /> Access is monitored and logged.</div><button className="primary-button wide" disabled={busy}>{busy ? <><span className="spinner" /> Verifying</> : <>Secure sign in <ArrowUpRight size={17} /></>}</button></form>
        <div className="ops-demo-note"><span className="demo-dot" /><span>Demo access</span><code>{role === 'manager' ? '8642' : '2468'}</code><button onClick={() => { setPin(role === 'manager' ? '8642' : '2468'); clearError(); }}>Use PIN</button></div>
        <div className="login-help">Access reserved for Northstar personnel.</div>
      </section>
    </main>
  );
}

function SummaryCard({ label, amount, icon: Icon, tone, note, onClick }) {
  return <button className={`summary-card ${tone}`} onClick={onClick}><div className="summary-top"><span>{label}</span><span className="summary-icon"><Icon size={18} /></span></div><strong>{money(amount)}</strong><div className="summary-bottom"><span>{note}</span><ArrowUpRight size={15} /></div></button>;
}

function TransactionList({ transactions, compact = false }) {
  if (!transactions.length) return <div className="empty-state"><span className="empty-icon"><ReceiptText size={21} /></span><strong>No transactions yet</strong><span>Your recent activity will show up here.</span></div>;
  return <div className={`transaction-list ${compact ? 'compact-list' : ''}`}>{transactions.map((tx) => {
    const Icon = txIcons[tx.type] || ReceiptText;
    const positive = ['deposit_cash', 'deposit_check'].includes(tx.type);
    return <div className="transaction-row" key={tx.id}><span className={`transaction-icon ${positive ? 'positive' : ''}`}><Icon size={17} /></span><div className="transaction-info"><strong>{txLabels[tx.type] || tx.type}</strong><span>{new Date(tx.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{tx.accountType ? ` · ${tx.accountType}` : ''}</span></div><strong className={`transaction-amount ${positive ? 'amount-positive' : ''}`}>{tx.type === 'balance_inquiry' ? '—' : `${positive ? '+' : tx.type === 'withdrawal' || tx.type === 'transfer' ? '−' : ''}${money(tx.amount)}`}</strong></div>;
  })}</div>;
}

function TransactionModal({ action, accountType, account, onClose, onSubmit, busy, error, clearError }) {
  const [amount, setAmount] = useState('');
  const [destinationAccountNumber, setDestination] = useState('');
  const needsAmount = action !== 'balance_inquiry';
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading">
    <button className="modal-close" aria-label="Close" onClick={onClose}><X size={19} /></button>
    <span className="section-icon"><span className="modal-action-icon">{(() => { const Icon = txIcons[action] || Wallet; return <Icon size={19} />; })()}</span></span>
    <div className="modal-title"><h2 id="modal-heading">{txLabels[action]}</h2><p>Using your <strong>{accountType}</strong> account</p></div>
    <Alert onClose={clearError}>{error}</Alert>
    {action === 'balance_inquiry' ? <div className="balance-result"><span>Available balance</span><strong>{money(account[accountType])}</strong><small>We'll print a receipt for this inquiry.</small></div> : null}
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ type: action, accountType, amount: needsAmount ? Number(amount) : 0, destinationAccountNumber }); }}>
      {needsAmount && <Field label="Amount (USD)" type="number" min="0.01" max="10000" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus required />}
      {action === 'transfer' && <Field label="Destination account number" inputMode="numeric" value={destinationAccountNumber} onChange={(e) => setDestination(e.target.value.replace(/\D/g, '').slice(0, 20))} placeholder="e.g. 1937" required />}
      {action.startsWith('deposit') && <div className="deposit-note"><span><ShieldCheck size={16} /></span><div><strong>Deposit recorded securely</strong><small>{action === 'deposit_check' ? 'Demo funds post now; real check availability depends on bank policy.' : 'Cash deposit will be included in the collection manifest.'}</small></div></div>}
      <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? <><span className="spinner" /> Processing</> : <>Confirm transaction <ArrowUpRight size={16} /></>}</button></div>
    </form>
  </section></div>;
}

function ReceiptModal({ transaction, account, onClose }) {
  return <div className="modal-backdrop"><section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-heading">
    <div className="receipt-success"><span><Check size={22} /></span></div><h2 id="receipt-heading">All taken care of.</h2><p>Your transaction has been completed.</p>
    <div className="receipt-paper"><div className="receipt-brand"><Brand compact /><span>ATM-001</span></div><div className="receipt-rule" /><div className="receipt-detail"><span>TRANSACTION</span><strong>{txLabels[transaction.type]}</strong></div><div className="receipt-detail"><span>ACCOUNT</span><strong>{transaction.accountType} · {account.accountNumber}</strong></div>{transaction.type !== 'balance_inquiry' && <div className="receipt-detail"><span>AMOUNT</span><strong>{money(transaction.amount)}</strong></div>}<div className="receipt-detail"><span>DATE & TIME</span><strong>{new Date(transaction.createdAt).toLocaleString()}</strong></div><div className="receipt-rule" /><div className="receipt-detail receipt-total"><span>{transaction.type === 'balance_inquiry' ? 'AVAILABLE BALANCE' : 'NEW BALANCE'}</span><strong>{money(transaction.type === 'balance_inquiry' ? account[transaction.accountType] : account[transaction.accountType])}</strong></div><div className="receipt-thanks">Thank you for banking with Northstar.</div></div>
    <div className="receipt-actions"><button className="secondary-button" onClick={onClose}>Done</button><button className="primary-button" onClick={() => window.print()}><Printer size={16} /> Print receipt</button></div>
  </section></div>;
}

function CustomerDashboard({ account, setAccount, token, onLogout }) {
  const [selectedAccount, setSelectedAccount] = useState('checking');
  const [transactions, setTransactions] = useState([]);
  const [action, setAction] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    request('/transactions', { token }).then((data) => setTransactions(data.transactions)).catch((reason) => setError(reason.message));
  }, [token]);
  const recent = transactions.slice(0, 5);
  const actions = [
    { type: 'balance_inquiry', label: 'Check balance', icon: CircleHelp, tone: 'action-blue', desc: 'View your available funds' },
    { type: 'withdrawal', label: 'Withdraw cash', icon: Banknote, tone: 'action-green', desc: 'Get cash from this ATM' },
    { type: 'deposit_cash', label: 'Deposit cash', icon: Plus, tone: 'action-amber', desc: 'Add cash to your account' },
    { type: 'deposit_check', label: 'Deposit a check', icon: FileText, tone: 'action-violet', desc: 'Deposit a check securely' },
    { type: 'transfer', label: 'Transfer funds', icon: ArrowLeftRight, tone: 'action-coral', desc: 'Send money to an account' },
  ];
  async function submitTransaction(payload) {
    setBusy(true); setError('');
    try {
      const data = await request('/transactions', { token, method: 'POST', body: JSON.stringify(payload) });
      setAccount(data.account);
      setTransactions((current) => [data.transaction, ...current]);
      setAction(null);
      setReceipt(data.transaction);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  return <main className="dashboard">
    <div className="dashboard-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR NORTHSTAR ACCOUNTS</div><h1>Good day, {account.name.split(' ')[0]}<span className="heading-period">.</span></h1><p>Here’s what’s happening with your money today.</p></div><div className="member-chip"><span className="member-avatar">{account.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{account.name}</strong><span>Everyday member</span></div><ChevronDown size={16} /></div></div>
    <Alert onClose={() => setError('')}>{error && !action ? error : ''}</Alert>
    <section className="balance-section"><div className="section-heading"><div><h2>Your balances</h2><span>Updated just now</span></div><button className="text-button" onClick={() => request('/me', { token }).then((data) => setAccount(data.account)).catch((reason) => setError(reason.message))}><RefreshCw size={14} /> Refresh</button></div><div className="balances-grid"><SummaryCard label="Checking account" amount={account.checking} icon={Wallet} tone="balance-primary" note={`Account ${account.accountNumber}`} onClick={() => setSelectedAccount('checking')} /><SummaryCard label="Savings account" amount={account.savings} icon={Landmark} tone="balance-secondary" note="A little saved goes a long way" onClick={() => setSelectedAccount('savings')} /></div></section>
    <div className="dashboard-columns"><section className="activity-card"><div className="section-heading"><div><h2>Recent activity</h2><span>{activityExpanded ? 'Your latest transactions' : 'Your last five transactions'}</span></div><button className="text-button" onClick={() => setActivityExpanded((value) => !value)}>{activityExpanded ? 'Show less' : 'View all'} <ArrowUpRight size={14} /></button></div><TransactionList transactions={activityExpanded ? transactions : recent} compact /></section>
      <section className="quick-actions"><div className="section-heading"><div><h2>What would you like to do?</h2><span>Choose an ATM service</span></div></div><div className="account-select"><span>Use account</span><button className={selectedAccount === 'checking' ? 'active' : ''} onClick={() => setSelectedAccount('checking')}>Checking</button><button className={selectedAccount === 'savings' ? 'active' : ''} onClick={() => setSelectedAccount('savings')}>Savings</button></div><div className="actions-grid">{actions.map(({ type, label, icon: Icon, tone, desc }) => <button key={type} className="action-tile" onClick={() => { setAction(type); setError(''); }}><span className={`action-icon ${tone}`}><Icon size={19} /></span><span className="action-copy"><strong>{label}</strong><small>{desc}</small></span><ArrowUpRight className="tile-arrow" size={16} /></button>)}</div></section>
    </div>
    <div className="dashboard-footer"><span><ShieldCheck size={15} /> Your account information is private and protected.</span><button onClick={onLogout}>Secure sign out <LogOut size={14} /></button></div>
    {action && <TransactionModal action={action} accountType={selectedAccount} account={account} onClose={() => setAction(null)} onSubmit={submitTransaction} busy={busy} error={error} clearError={() => setError('')} />}
    {receipt && <ReceiptModal transaction={receipt} account={account} onClose={() => setReceipt(null)} />}
  </main>;
}

function StatCard({ label, value, icon: Icon, tone, sub }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={18} /></span><div><span className="stat-label">{label}</span><strong>{value}</strong><small>{sub}</small></div></div>;
}

function OperationsDashboard({ token, role, onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cash, setCash] = useState('');
  const [paper, setPaper] = useState('');
  const [collect, setCollect] = useState(false);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const manager = role === 'manager';
  const refresh = () => request('/ops/dashboard', { token }).then((result) => { setData(result); setOnline(result.atm.is_online); }).catch((reason) => setError(reason.message));
  useEffect(() => { refresh(); }, [token]);
  const reports = useMemo(() => {
    const all = data?.transactions || [];
    return {
      deposits: all.filter((tx) => tx.type === 'deposit_cash' || tx.type === 'deposit_check').reduce((sum, tx) => sum + tx.amount, 0),
      withdrawals: all.filter((tx) => tx.type === 'withdrawal').reduce((sum, tx) => sum + tx.amount, 0),
      count: all.length,
    };
  }, [data]);
  const filteredTransactions = (data?.transactions || []).filter((tx) => filter === 'all' || (filter === 'deposits' ? tx.type.startsWith('deposit') : tx.type === 'withdrawal'));
  async function submitMaintenance(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await request('/ops/maintenance', { token, method: 'POST', body: JSON.stringify({ cashAmount: Number(cash || 0), paperRolls: Number(paper || 0), collectDeposits: collect, isOnline: online === data.atm.is_online ? null : online }) });
      setCash(''); setPaper(''); setCollect(false); await refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  return <main className="ops-dashboard">
    <div className="ops-page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> ATM NETWORK · OPERATIONS</div><h1>{manager ? 'Network overview' : 'Service & supplies'}<span className="heading-period">.</span></h1><p>{manager ? 'A clear picture of activity and cash across your ATM.' : 'Replenish this ATM and take care of daily collection.'}</p></div><div className={`atm-online ${data?.atm.is_online ? '' : 'offline'}`}><span className="status-dot" /><div><strong>ATM-001 · Downtown</strong><small>{data?.atm.is_online ? 'Operational' : 'Offline'} <span>·</span> Updated just now</small></div></div></div>
    <Alert onClose={() => setError('')}>{error}</Alert>
    {data && <><section className="stat-grid"><StatCard label="Cash available" value={money(data.atm.cash_balance)} icon={Banknote} tone="stat-green" sub={data.atm.is_online ? 'Ready for withdrawal' : 'ATM is offline'} />{manager ? <><StatCard label="Total deposits" value={money(reports.deposits)} icon={ArrowDownLeft} tone="stat-blue" sub="Across recent activity" /><StatCard label="Total withdrawals" value={money(reports.withdrawals)} icon={ArrowUpRight} tone="stat-amber" sub="Across recent activity" /><StatCard label="Transactions" value={reports.count} icon={ReceiptText} tone="stat-violet" sub="Most recent 100" /></> : <><StatCard label="Printer supplies" value={`${data.atm.paper_rolls} rolls`} icon={Printer} tone="stat-violet" sub="Receipt paper remaining" /><StatCard label="Deposits to collect" value={money(Number(data.atm.cash_deposits_pending) + Number(data.atm.check_deposits_pending))} icon={Wallet} tone="stat-amber" sub="Cash & check deposit bag" /></>}</section>
      {manager && <section className="pending-grid"><div className="pending-card"><span><Banknote size={17} /> Cash deposits pending</span><strong>{money(data.atm.cash_deposits_pending)}</strong></div><div className="pending-card"><span><FileText size={17} /> Check deposits pending</span><strong>{money(data.atm.check_deposits_pending)}</strong></div><div className="pending-card"><span><Printer size={17} /> Printer paper rolls</span><strong>{data.atm.paper_rolls} <small>rolls</small></strong></div></section>}
      <div className="ops-content-grid"><section className="ops-activity-card"><div className="section-heading"><div><h2>ATM activity</h2><span>Latest recorded transactions</span></div><div className="filter-tabs">{['all', 'deposits', 'withdrawals'].map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></div><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>ACTIVITY</th><th>ACCOUNT</th><th>DATE & TIME</th><th className="right">AMOUNT</th></tr></thead><tbody>{filteredTransactions.slice(0, 25).map((tx) => { const Icon = txIcons[tx.type] || ReceiptText; return <tr key={tx.id}><td><span className={`table-type-icon ${tx.type.startsWith('deposit') ? 'positive' : ''}`}><Icon size={15} /></span><span className="table-type-copy"><strong>{txLabels[tx.type]}</strong><small>{tx.accountType} account</small></span></td><td>{tx.accountName || 'Account holder'}</td><td>{new Date(tx.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td><td className="right">{tx.type === 'balance_inquiry' ? '—' : money(tx.amount)}</td></tr>; })}</tbody></table>{filteredTransactions.length === 0 && <div className="empty-inline">No matching activity yet.</div>}</div></section>
        {!manager && <section className="maintenance-card"><div className="maintenance-heading"><span className="section-icon"><RefreshCw size={18} /></span><div><h2>Service this ATM</h2><p>Log a refill or deposit collection.</p></div></div><form onSubmit={submitMaintenance}><Field label="Cash to add (USD)" type="number" min="0" max="100000" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0.00" /><Field label="Printer paper rolls" type="number" min="0" max="100" step="1" value={paper} onChange={(e) => setPaper(e.target.value)} placeholder="0" /><label className="checkbox-field"><input type="checkbox" checked={collect} onChange={(e) => setCollect(e.target.checked)} /><span>Collect deposit bag</span></label><label className="checkbox-field"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /><span>ATM is online</span></label><button className="primary-button wide" disabled={busy}>{busy ? <><span className="spinner" /> Saving update</> : <>Log service update <ArrowUpRight size={16} /></>}</button></form><div className="maintenance-note"><ShieldCheck size={14} /> All service actions are recorded.</div></section>}</div></>}
    <div className="dashboard-footer"><span><ShieldCheck size={15} /> Signed in as {manager ? 'Bank manager' : 'ATM operator'}.</span><button onClick={onLogout}>Secure sign out <LogOut size={14} /></button></div>
  </main>;
}

export default function App() {
  const [mode, setMode] = useState('customer');
  const [token, setToken] = useState('');
  const [account, setAccount] = useState(null);
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoMode, setDemoMode] = useState(true);
  useEffect(() => { request('/health').then((data) => setDemoMode(data.mode === 'demo')).catch(() => setError('The ATM service is not available. Start the API server and try again.')); }, []);
  async function customerLogin(credentials) {
    setBusy(true); setError('');
    try {
      const data = await request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
      setToken(data.token); setAccount(data.account); setRole('');
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function opsLogin(credentials) {
    setBusy(true); setError('');
    try {
      const data = await request('/ops/login', { method: 'POST', body: JSON.stringify(credentials) });
      setToken(data.token); setRole(data.role); setAccount(null);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { if (token) await request('/auth/logout', { token, method: 'POST' }); }
    finally { setToken(''); setAccount(null); setRole(''); setError(''); }
  }
  const signedIn = Boolean(token);
  return <div className="app-shell"><Header mode={mode} onMode={(value) => { setMode(value); setError(''); }} onLogout={logout} signedIn={signedIn} demoMode={demoMode} />
    {!signedIn ? mode === 'customer' ? <CustomerLogin onLogin={customerLogin} busy={busy} error={error} clearError={() => setError('')} /> : <OpsLogin onLogin={opsLogin} busy={busy} error={error} clearError={() => setError('')} /> : account ? <CustomerDashboard account={account} setAccount={setAccount} token={token} onLogout={logout} /> : <OperationsDashboard token={token} role={role} onLogout={logout} />}
    <footer className="site-footer"><span>© 2026 Northstar Financial</span><span><LockKeyhole size={12} /> Secure by design</span><a href="mailto:support@northstar.example">Help & support</a></footer>
  </div>;
}
