import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BadgeCheck,
  Heart,
  Home,
  KeyRound,
  LogIn,
  Minus,
  PackageCheck,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { rawProducts } from './products.js';
import './styles.css';

const bank = {
  accountName: 'LI XUEDONG',
  copyLine: '토스뱅크 1002-7027-8549',
};

const usersKey = 'olive-deal-shop:users';
const activeKey = 'olive-active-user';
const ordersKey = 'skinbeauty:orders';
const analyticsKey = 'skinbeauty:analytics';
const sessionKey = 'skinbeauty:session-id';
const userKey = (name) => `olive-deal-shop:${name}`;
const statuses = ['接单前', '已发货', '快递单照片登录', '已送达', '交易完成'];

const money = (value) => `₩${Number(value || 0).toLocaleString('ko-KR')}`;
const loadJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};
const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const blankUser = () => ({ cart: {}, favorites: [], phone: '', addresses: [], deletedAt: null });
const normalize = (s) => String(s || '').toLowerCase();

function getSessionId() {
  const existing = sessionStorage.getItem(sessionKey);
  if (existing) return existing;
  const next = crypto.randomUUID();
  sessionStorage.setItem(sessionKey, next);
  return next;
}

function detectSource() {
  const params = new URLSearchParams(location.search);
  const rawSource = normalize([params.get('utm_source'), params.get('source'), params.get('from'), params.get('channel')].filter(Boolean).join(' '));
  const referrer = normalize(document.referrer);
  const ua = normalize(navigator.userAgent);
  const combined = `${rawSource} ${referrer} ${ua}`;

  if (/xiaohongshu|xhs|redbook|小红书/.test(combined)) return '小红书';
  if (/micromessenger|wechat|weixin|微信/.test(combined)) return '微信';
  return '浏览器';
}

function getAttribution() {
  const params = new URLSearchParams(location.search);
  return {
    source: detectSource(),
    landingPath: `${location.pathname}${location.search}`,
    referrer: document.referrer || '',
    userAgent: navigator.userAgent,
    utm: {
      source: params.get('utm_source') || params.get('source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
      content: params.get('utm_content') || '',
      term: params.get('utm_term') || '',
    },
  };
}

function recordPageView() {
  const analytics = loadJson(analyticsKey, { pageviews: [] });
  const view = {
    id: crypto.randomUUID(),
    sessionId: getSessionId(),
    at: new Date().toISOString(),
    title: document.title,
    ...getAttribution(),
  };
  saveJson(analyticsKey, { ...analytics, pageviews: [view, ...(analytics.pageviews || [])].slice(0, 500) });
  return view;
}

function enrichProduct(product, index) {
  const title = product.displayName || product.name;
  const spec = product.specification || '';
  const tags = [product.category, product.brand, product.discountRate >= 20 ? '高折扣' : '', index % 9 === 0 ? '热卖' : '']
    .filter(Boolean)
    .slice(0, 3);
  return { ...product, displayTitle: title, displaySpec: spec, effect: product.effect || product.category, officialUrl: product.officialProductUrl || product.officialUrl, badges: tags };
}

const products = rawProducts.map(enrichProduct);

function App() {
  const [activeUser, setActiveUser] = useState(() => localStorage.getItem(activeKey) || '');
  const [saved, setSaved] = useState(() => (activeUser ? { ...blankUser(), ...loadJson(userKey(activeUser), {}) } : blankUser()));
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('全部品牌');
  const [effect, setEffect] = useState('全部功效');
  const [sort, setSort] = useState('推荐排序');
  const [panel, setPanel] = useState('');
  const [toast, setToast] = useState('');
  const [auth, setAuth] = useState({ username: '', countryCode: '+82', phoneNumber: '', code: '' });
  const [attribution, setAttribution] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setAttribution(recordPageView());
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 2200);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (activeUser) {
      localStorage.setItem(activeKey, activeUser);
      saveJson(userKey(activeUser), saved);
    }
  }, [activeUser, saved]);

  const brands = useMemo(() => ['全部品牌', ...Array.from(new Set(products.map((p) => p.brand))).sort()], []);
  const effects = useMemo(() => ['全部功效', ...Array.from(new Set(products.map((p) => p.effect))).sort()], []);
  const filtered = useMemo(() => {
    const q = normalize(query);
    const list = products.filter((p) => {
      const matchesBrand = brand === '全部品牌' || p.brand === brand;
      const matchesEffect = effect === '全部功效' || p.effect === effect;
      const haystack = normalize([p.displayTitle, p.brand, p.category, p.displaySpec].join(' '));
      return matchesBrand && matchesEffect && (!q || haystack.includes(q));
    });
    return [...list].sort((a, b) => {
      if (sort === '价格从低到高') return a.price - b.price;
      if (sort === '价格从高到低') return b.price - a.price;
      if (sort === '折扣优先') return b.discountRate - a.discountRate;
      return 0;
    });
  }, [query, brand, effect, sort]);

  const cartItems = Object.entries(saved.cart || {})
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((line) => line.product && line.qty > 0);
  const cartCount = cartItems.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = cartItems.reduce((sum, line) => sum + line.product.price * line.qty, 0);

  const notify = (message) => setToast(message);
  const requireLogin = () => {
    if (!activeUser) {
      notify('请先用手机号验证码登录');
      return false;
    }
    return true;
  };
  const updateCart = (id, qty) => {
    if (!requireLogin()) return;
    setSaved((old) => {
      const cart = { ...old.cart };
      if (qty <= 0) delete cart[id];
      else cart[id] = Math.min(99, qty);
      return { ...old, cart };
    });
  };
  const addFavorite = (id) => {
    if (!requireLogin()) return;
    setSaved((old) => ({
      ...old,
      favorites: old.favorites.includes(id) ? old.favorites.filter((x) => x !== id) : [...old.favorites, id],
    }));
  };
const sendCode = async () => {
  if (!auth.username.trim() || !auth.phoneNumber.trim()) {
    return notify('请填写用户名和手机号');
  }

  notify('测试验证码：123456');
};

const submitAuth = async (event) => {
  event.preventDefault();

  if (!auth.username.trim() || !auth.phoneNumber.trim()) {
    return notify('请填写用户名和手机号');
  }

  if (auth.code !== '123456') {
    return notify('验证码错误');
  }

  const users = loadJson(usersKey, {});
  users[auth.username] = {
    phone: auth.phoneNumber,
    lastLoginAt: new Date().toISOString(),
    attribution: attribution || getAttribution()
  };

  saveJson(usersKey, users);
  setActiveUser(auth.username);
  setSaved({
    ...blankUser(),
    ...loadJson(userKey(auth.username), {}),
    phone: auth.phoneNumber,
    attribution: attribution || getAttribution()
  });

  notify('登录成功');
};  const submitOrder = async () => {
  if (!requireLogin()) return;
  if (!cartItems.length) return notify('购物车为空');

  const shippingFee = cartCount >= 5 ? 0 : 3000;

  const order = {
    id: `SB-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    username: activeUser,
    customerPhone: saved.phone,
    items: cartItems.map(({ product, qty }) => ({
      id: product.id,
      brand: product.brand,
      name: product.displayTitle,
      spec: product.displaySpec,
      price: product.price,
      qty
    })),
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    address: saved.addresses[0] || null,
    payerName: '',
    status: statuses[0],
    transferConfirmed: false,
    attribution: saved.attribution || attribution || getAttribution(),
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(order)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '订单提交失败');
    }

    setSaved((old) => ({ ...old, cart: {} }));
    notify('订单已提交');
    setPanel('profile');
  } catch (error) {
    notify(error.message);
  }
};
  if (location.pathname === '/admin') return <AdminPage />;

  return (
    <>
      <header className="topbar">
        <button className="brand-logo" onClick={() => setPanel('')}>
          <span>skinbeauty</span>
          <small>AUTHENTIC K-BEAUTY</small>
        </button>
        <label className="header-search">
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索品牌、功效、商品名" />
        </label>
        <div className="header-actions">
          {activeUser ? (
            <button className="user-pill" onClick={() => setPanel('profile')}>
              <User size={16} />
              <span>{activeUser}</span>
            </button>
          ) : (
            <AuthForm auth={auth} setAuth={setAuth} onSendCode={sendCode} onSubmit={submitAuth} sending={sending} />
          )}
          <button className="action-button" onClick={() => setPanel('favorites')}>
            <Heart size={17} />
            <span>{saved.favorites.length}</span>
          </button>
          <button className="action-button primary" onClick={() => setPanel('cart')}>
            <ShoppingBag size={17} />
            <span>{cartCount}</span>
          </button>
        </div>
      </header>
      <main>
        <section className="trust-strip">
          <div><PackageCheck size={19} /><strong>韩国现货</strong><span>精选正品护肤</span></div>
          <div><ShoppingBag size={19} /><strong>5 件包邮</strong><span>不足 5 件运费 ₩3,000</span></div>
          <div><Home size={19} /><strong>转账结账</strong><span>提交后按订单发货</span></div>
        </section>
        <section className="filters">
          <Select label="品牌" value={brand} onChange={setBrand} options={brands} />
          <Select label="功效" value={effect} onChange={setEffect} options={effects} />
          <Select label="价格" value={sort} onChange={setSort} options={['推荐排序', '价格从低到高', '价格从高到低', '折扣优先']} />
        </section>
        <section className="product-grid">
          {filtered.map((product, index) => (
            <ProductRow
              key={product.id}
              product={product}
              qty={saved.cart[product.id] || 0}
              liked={saved.favorites.includes(product.id)}
              onQty={updateCart}
              onLike={addFavorite}
            />
          ))}
        </section>
      </main>
      {panel === 'cart' && <Panel title="购物车" onClose={() => setPanel('')}><Cart items={cartItems} count={cartCount} subtotal={subtotal} onQty={updateCart} onSubmit={submitOrder} /></Panel>}
      {panel === 'favorites' && <Panel title="收藏" onClose={() => setPanel('')}><FavoriteList ids={saved.favorites} /></Panel>}
{panel === 'profile' && (
  <Panel title="个人主页" onClose={() => setPanel('')}>
    {activeUser ? (
      <Profile
        username={activeUser}
        saved={saved}
        setSaved={setSaved}
        notify={notify}
        logout={() => {
          localStorage.removeItem(activeKey);
          setActiveUser('');
          setSaved(blankUser());
        }}
      />
    ) : (
      <AuthForm
        auth={auth}
        setAuth={setAuth}
        onSendCode={sendCode}
        onSubmit={submitAuth}
        sending={sending}
      />
    )}
  </Panel>
)}      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function AuthForm({ auth, setAuth, onSendCode, onSubmit, sending }) {
  return (
    <form className="auth-box" onSubmit={onSubmit}>
      <label className="auth-field username-field">
        <User size={15} />
        <input value={auth.username} onChange={(e) => setAuth((old) => ({ ...old, username: e.target.value }))} placeholder="用户名" />
      </label>
      <label className="auth-field phone-field">
        <Smartphone size={15} />
        <input className="country-input" value={auth.countryCode} onChange={(e) => setAuth((old) => ({ ...old, countryCode: e.target.value }))} aria-label="国家区号" />
        <input value={auth.phoneNumber} onChange={(e) => setAuth((old) => ({ ...old, phoneNumber: e.target.value }))} placeholder="手机号" />
      </label>
      <label className="auth-field code-field">
        <KeyRound size={15} />
        <input value={auth.code} onChange={(e) => setAuth((old) => ({ ...old, code: e.target.value }))} placeholder="验证码" />
        <button type="button" onClick={onSendCode} disabled={sending}>{sending ? '发送中' : '发送'}</button>
      </label>
      <button className="login-button" type="submit">
        <LogIn size={15} />
        <span>登录</span>
      </button>
      <span className="auth-note"><BadgeCheck size={13} /> 测试码 123456</span>
    </form>
  );
}

function Select({ label, value, onChange, options }) {
  return <label className="filter-select"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>;
}

function ProductImage({ product }) {
  const [source, setSource] = useState(product.thumbnailUrl || product.imageUrl);
  const [failed, setFailed] = useState(false);
  const fallback = product.imageUrl && source !== product.imageUrl ? product.imageUrl : '';

  if (failed) {
    return (
      <div className="product-image image-fallback">
        <span>{String(product.brand || product.displayTitle || 'S').slice(0, 1).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div className="product-image">
      <img
        src={source}
        alt={product.displayTitle}
        loading="lazy"
        onError={() => (fallback ? setSource(fallback) : setFailed(true))}
      />
    </div>
  );
}

function ProductRow({ product, qty, liked, onQty, onLike }) {
  return (
    <article className="product-card">
      <ProductImage product={product} />
      <div className="product-body">
        <div className="product-meta"><span>{product.brand}</span><span>正品</span></div>
        <h2>{product.displayTitle}</h2>
        {product.displaySpec && <div className="spec-line">{product.displaySpec}</div>}
        <div className="tag-row">{product.badges.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="price-row">
          <strong>{money(product.price)}</strong>
          {product.listPrice > product.price && <del>{money(product.listPrice)}</del>}
          <span>{product.discountRate}%</span>
        </div>
        <div className="card-actions">
          {qty ? (
            <div className="quantity">
              <button onClick={() => onQty(product.id, qty - 1)} aria-label="减少"><Minus size={14} /></button>
              <span>{qty}</span>
              <button onClick={() => onQty(product.id, qty + 1)} aria-label="增加">+</button>
            </div>
          ) : (
            <button className="buy-button" onClick={() => onQty(product.id, 1)}>
              <ShoppingBag size={17} />
              <span>加入购物车</span>
            </button>
          )}
          <button className={liked ? 'icon-button liked' : 'icon-button'} onClick={() => onLike(product.id)} aria-label="收藏"><Heart size={18} fill={liked ? 'currentColor' : 'none'} /></button>
        </div>
        {(product.showOlvyLink || product.showOfficialLink) && (
          <div className="source-links">
            {product.showOlvyLink && product.sourceSearchUrl && <a href={product.sourceSearchUrl} target="_blank" rel="noreferrer">和 olvy 比</a>}
            {product.showOfficialLink && product.officialUrl && <a href={product.officialUrl} target="_blank" rel="noreferrer">官方商品页</a>}
          </div>
        )}
      </div>
    </article>
  );
}

function Panel({ title, children, onClose }) {
  return <aside className="panel"><div className="panel-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button></div>{children}</aside>;
}

function Cart({ items, count, subtotal, onQty, onSubmit }) {
  const shippingFee = count >= 5 ? 0 : 3000;
  return (
    <div className="panel-body">
      <div className="shipping-progress"><strong>{count >= 5 ? '已达成包邮' : `还差 ${5 - count} 件包邮`}</strong><span>{count} 件 · {money(subtotal)}</span></div>
      <div className="line-list">
        {items.length ? items.map(({ product, qty }) => <div className="mini-line" key={product.id}><ProductImage product={product} /><div><strong>{product.displayTitle}</strong><span>{money(product.price)} x {qty}</span></div><div className="quantity"><button onClick={() => onQty(product.id, qty - 1)}>-</button><span>{qty}</span><button onClick={() => onQty(product.id, qty + 1)}>+</button></div><button className="icon-button" onClick={() => onQty(product.id, 0)}><Trash2 size={16} /></button></div>) : <div className="empty-state">购物车为空</div>}
      </div>
      <div className="checkout-summary">
        <Summary label="商品金额" value={money(subtotal)} />
        <Summary label="运费" value={shippingFee ? money(shippingFee) : '包邮'} />
        <Summary label="最终金额" value={money(subtotal + shippingFee)} strong />
        <div className="copy-row"><span>转账账户</span><strong>{bank.copyLine}</strong></div>
        <button className="checkout-button" onClick={onSubmit}>提交订单</button>
      </div>
    </div>
  );
}

function FavoriteList({ ids }) {
  const liked = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  return <div className="line-list">{liked.length ? liked.map((p) => <div className="mini-line" key={p.id}><ProductImage product={p} /><div><strong>{p.displayTitle}</strong><span>{p.brand} · {money(p.price)}</span></div></div>) : <div className="empty-state">暂无收藏</div>}</div>;
}

function Profile({ username, saved, setSaved, notify, logout }) {
  const [address, setAddress] = useState({ name: '', phone: '', zip: '', road: '', detail: '' });
  const [orders, setOrders] = useState(() => loadJson(ordersKey, []).filter((order) => order.username === username));
  const addAddress = (event) => {
    event.preventDefault();
    if (!address.name || !address.phone || !address.zip || !address.road) return notify('请填写姓名、手机号、邮编和道路名地址');
    setSaved((old) => ({ ...old, addresses: [{ ...address, id: crypto.randomUUID() }, ...old.addresses] }));
    setAddress({ name: '', phone: '', zip: '', road: '', detail: '' });
    notify('收货地址已保存');
  };
  const deleteOrder = (id) => {
    const all = loadJson(ordersKey, []).filter((order) => order.id !== id);
    saveJson(ordersKey, all);
    setOrders((old) => old.filter((order) => order.id !== id));
    notify('订单已删除');
  };
  return (
    <div className="profile-page">
      <div className="profile-card"><User size={19} /><div><strong>{username}</strong><span>{saved.phone || '已登录用户'}</span></div><button onClick={logout}>退出</button></div>
      <form className="address-form" onSubmit={addAddress}>
        <h3>收货地址</h3>
        <div className="address-grid">
          <input value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} placeholder="收货人" />
          <input value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} placeholder="联系电话" />
          <input value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} placeholder="邮编" />
          <input value={address.road} onChange={(e) => setAddress({ ...address, road: e.target.value })} placeholder="道路名地址" />
        </div>
        <input value={address.detail} onChange={(e) => setAddress({ ...address, detail: e.target.value })} placeholder="详细地址" />
        <button type="submit">保存地址</button>
      </form>
      <section className="submitted-orders">
        <h3>已提交订单</h3>
        {orders.length ? orders.map((order) => (
          <article className="submitted-order" key={order.id}>
            <div className="submitted-order-head"><strong>{order.id}</strong><span>{order.status}</span></div>
            <div className="submitted-order-items">{order.items.map((item) => <span key={item.id}>{item.name} x {item.qty}</span>)}</div>
            <div className="submitted-order-foot"><strong>{money(order.total)}</strong><button className="danger-button" onClick={() => deleteOrder(order.id)}>删除订单</button></div>
          </article>
        )) : <span className="submitted-empty">暂无已提交订单</span>}
      </section>
    </div>
  );
}

function Summary({ label, value, strong }) {
  return <div className={strong ? 'summary-row strong' : 'summary-row'}><span>{label}</span><strong>{value}</strong></div>;
}

function AdminPage() {
const [adminTab, setAdminTab] = useState('dashboard');
const [orders, setOrders] = useState([]);
const [ordersLoading, setOrdersLoading] = useState(true);
const [ordersError, setOrdersError] = useState('');
useEffect(() => {
  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      setOrdersError('');

      const response = await fetch('/api/orders');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '订单读取失败');
      }

      setOrders(data.orders || []);
    } catch (error) {
      setOrdersError(error.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  loadOrders();
}, []);
const [analytics] = useState(() => loadJson(analyticsKey, { pageviews: [] }));
const [open, setOpen] = useState('');

const [orderSearch, setOrderSearch] = useState('');
const [statusFilter, setStatusFilter] = useState('全部');
const [startDate, setStartDate] = useState('');
const [endDate, setEndDate] = useState('');  const pageviews = analytics.pageviews || [];
  const pageviewSources = pageviews.reduce((acc, view) => {
    const source = view.source || '浏览器';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const orderSources = orders.reduce((acc, order) => {
    const source = order.attribution?.source || '未记录';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const sourceSummary = (counts) => ['小红书', '微信', '浏览器', '未记录']
    .filter((source) => counts[source])
    .map((source) => `${source} ${counts[source]}`)
    .join(' · ') || '暂无';
const update = async (id, patch) => {
  try {
    const response = await fetch('/api/orders', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        id,
        ...patch
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '订单更新失败');
    }

    setOrders((old) =>
      old.map((order) =>
        order.id === id
          ? { ...order, ...patch }
          : order
      )
    );
  } catch (error) {
    alert(error.message);
  }
};

const uploadShippingReceipt = async (orderId, file) => {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件');
    return;
  }

  try {
    const uploadResponse = await fetch('/api/upload-receipt', {
      method: 'POST',
      headers: {
        'content-type': file.type,
        'x-filename': file.name
      },
      body: file
    });

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok) {
      throw new Error(uploadData.error || '快递单照片上传失败');
    }

    await update(orderId, {
      shippingReceiptUrl: uploadData.pathname
    });

    alert('快递单照片上传成功');
  } catch (error) {
    alert(error.message);
  }
};
const filteredOrders = orders.filter((order) => {
  const search = orderSearch.trim().toLowerCase();

  const customerName =
    order.customerName ||
    order.username ||
    '';

  const phone =
    order.customerPhone ||
    order.addressPhone ||
    '';
  const matchesSearch =
    !search ||
    String(order.id || '').toLowerCase().includes(search) ||
    String(phone).toLowerCase().includes(search) ||
    String(customerName).toLowerCase().includes(search);

  const matchesStatus =
    statusFilter === '全部' ||
    order.status === statusFilter;

  const orderDate = order.createdAt
    ? order.createdAt.slice(0, 10)
    : '';

  const matchesStart =
    !startDate || orderDate >= startDate;

  const matchesEnd =
    !endDate || orderDate <= endDate;

  return matchesSearch && matchesStatus && matchesStart && matchesEnd;
});
  return (
    <div className="admin-page">
      <header className="admin-topbar"><a className="admin-brand" href="/">skinbeauty</a><nav><a href="/">商城首页</a><a href="/admin">后台管理</a></nav></header>
      <div className="admin-layout">
  <aside className="admin-sidebar">
    <button
      className={adminTab === 'dashboard' ? 'active' : ''}
      onClick={() => setAdminTab('dashboard')}
    >
      대시보드
    </button>

    <button
      className={adminTab === 'analytics' ? 'active' : ''}
      onClick={() => setAdminTab('analytics')}
    >
      전환분석
    </button>

    <button
      className={adminTab === 'orders' ? 'active' : ''}
      onClick={() => setAdminTab('orders')}
    >
      주문신청
    </button>
  </aside>

 <main className="admin-shell">

  {adminTab === 'dashboard' && (
    <>
      <header className="admin-header">
        <h1>대시보드</h1>
        <p>전체 주문 및 방문 현황을 확인할 수 있습니다.</p>
      </header>

      <section className="analytics-cards">
        <article>
          <span>전체 주문</span>
          <strong>{orders.length}</strong>
          <small>누적 주문 건수</small>
        </article>

        <article>
          <span>Pageview</span>
          <strong>{pageviews.length}</strong>
          <small>{sourceSummary(pageviewSources)}</small>
        </article>

        <article>
          <span>주문 유입경로</span>
          <strong>{sourceSummary(orderSources)}</strong>
          <small>주문 시 자동 기록</small>
        </article>
      </section>
    </>
  )}

  {adminTab === 'analytics' && (
    <>
      <header className="admin-header">
        <h1>전환분석</h1>
        <p>방문 및 주문 전환 데이터를 확인할 수 있습니다.</p>
      </header>

      <section className="analytics-cards">
        <article>
          <span>Pageview</span>
          <strong>{pageviews.length}</strong>
          <small>{sourceSummary(pageviewSources)}</small>
        </article>

        <article>
          <span>주문 유입경로</span>
          <strong>{sourceSummary(orderSources)}</strong>
          <small>주문 기준</small>
        </article>

        <article>
          <span>최근 방문</span>
          <strong>{pageviews[0]?.source || '없음'}</strong>
          <small>{pageviews[0]?.landingPath || '방문 기록 없음'}</small>
        </article>
      </section>
    </>
  )}

  {adminTab === 'orders' && (
    <>
      <header className="admin-header">
        <h1>주문신청</h1>
        <p>
          전체 {orders.length}건 · 검색 결과 {filteredOrders.length}건
        </p>
      </header>

      <section className="order-filters">
        <div className="order-date-filter">
          <label>
            시작일
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <span>~</span>

          <label>
            종료일
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="全部">전체 상태</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <input
          className="order-search"
          type="search"
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          placeholder="주문번호, 휴대폰번호, 고객명 검색"
        />

        <button
          type="button"
          onClick={() => {
            setStartDate('');
            setEndDate('');
            setStatusFilter('全部');
            setOrderSearch('');
          }}
        >
          초기화
        </button>
      </section>

      <section className="admin-order-list">

        <div className="admin-order-table-head">
          <span>상태</span>
          <span>주문번호</span>
          <span>고객명</span>
          <span>휴대폰번호</span>
          <span>구매일</span>
          <span>주소</span>
          <span>총금액</span>
          <span>상세</span>
        </div>

        {filteredOrders.length ? (
          filteredOrders.map((order) => {
         const customerName =
  order.customerName ||
  order.username ||
  '-';

const phone =
  order.customerPhone ||
  order.addressPhone ||
  '-';

const fullAddress =
  [
    order.postalCode,
    order.roadAddress,
    order.detailAddress
  ]
    .filter(Boolean)
    .join(' ') || '-';
            const purchaseDate = order.createdAt
              ? new Date(order.createdAt).toLocaleString('ko-KR')
              : '-';

            return (
              <article
                className="admin-list-order"
                key={order.id}
              >
                <div className="admin-order-table-row">
                  <span>{order.status}</span>

                  <strong>{order.id}</strong>

                  <span>{customerName}</span>

                  <span>{phone}</span>

                  <span>{purchaseDate}</span>

                  <span className="order-address">
                    {fullAddress}
                  </span>

                  <strong>{money(order.total)}</strong>

                  <button
                    type="button"
                    onClick={() =>
                      setOpen(open === order.id ? '' : order.id)
                    }
                  >
                    {open === order.id ? '닫기' : '상세'}
                  </button>
                </div>

                {open === order.id && (
                  <div className="admin-order-detail">

                    <div>
                      <h3>고객 정보</h3>
                      <p>아이디: {order.username || '-'}</p>
                      <p>고객명: {customerName}</p>
                      <p>휴대폰번호: {phone}</p>
                      <p>주소: {fullAddress}</p>
                    </div>

                    <div>
                      <h3>주문 정보</h3>
                      <p>주문번호: {order.id}</p>
                      <p>구매일: {purchaseDate}</p>
                      <p>상품금액: {money(order.subtotal)}</p>
                      <p>배송비: {money(order.shippingFee)}</p>
                      <p>총금액: {money(order.total)}</p>
                    </div>

                    <div>
                      <h3>구매 상품</h3>

                      {order.items?.map((item) => (
                        <p key={item.id}>
                          {item.name}
                          {item.spec ? ` / ${item.spec}` : ''}
                          {' × '}
                          {item.qty}
                          {' / '}
                          {money(item.price)}
                        </p>
                      ))}
                    </div>

                    <div>
                      <h3>관리</h3>

                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(order.transferConfirmed)}
                          onChange={(e) =>
                            update(order.id, {
                              transferConfirmed: e.target.checked
                            })
                          }
                        />
                        입금 확인
                      </label>

                      <select
                        value={order.status}
                        onChange={(e) =>
                          update(order.id, {
                            status: e.target.value
                          })
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
{order.status === '已发货' && (
  <div className="shipping-receipt-upload">
    <label>
      快递单照片
      <input
        type="file"
        accept="image/*"
        onChange={(e) =>
          uploadShippingReceipt(
            order.id,
            e.target.files?.[0]
          )
        }
      />
    </label>

 {order.shippingReceiptUrl && (
  <div>
    <p>✓ 已上传快递单照片</p>

    <button
      type="button"
      onClick={() =>
        window.open(
          `/api/receipt-image?pathname=${encodeURIComponent(order.shippingReceiptUrl)}`,
          '_blank'
        )
      }
    >
      查看快递单照片
    </button>
  </div>
)}
  </div>
)}
                    </div>

                    <div>
                      <h3>유입 정보</h3>
                      <p>
                        유입경로: {order.attribution?.source || '미기록'}
                      </p>
                      <p>
                        랜딩페이지: {order.attribution?.landingPath || '-'}
                      </p>
                      <p>
                        Referrer: {order.attribution?.referrer || '-'}
                      </p>
                    </div>

                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="empty-state">
            조건에 맞는 주문이 없습니다.
          </div>
        )}

      </section>
    </>
  )}

</main>
       </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
