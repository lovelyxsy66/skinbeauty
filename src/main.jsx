import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Heart,
  Home,
  Minus,
  PackageCheck,
  Search,
  ShoppingBag,
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

function enrichProduct(product, index) {
  const title = product.displayName || product.name;
  const spec = product.specification || '';
  const tags = [product.category, product.brand, product.discountRate >= 20 ? '高折扣' : '', index % 9 === 0 ? '热卖' : '']
    .filter(Boolean)
    .slice(0, 3);
  return { ...product, displayTitle: title, displaySpec: spec, effect: product.effect || product.category, badges: tags };
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
  const [sending, setSending] = useState(false);

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
    if (!auth.username.trim() || !auth.phoneNumber.trim()) return notify('请填写用户名和手机号');
    setSending(true);
    try {
      const response = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(auth),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '验证码发送失败');
      notify('短信验证码已发送');
    } catch (error) {
      notify(error.message);
    } finally {
      setSending(false);
    }
  };
  const submitAuth = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(auth),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '验证码错误');
      const users = loadJson(usersKey, {});
      users[auth.username] = { phone: data.phone, lastLoginAt: new Date().toISOString() };
      saveJson(usersKey, users);
      setActiveUser(auth.username);
      setSaved({ ...blankUser(), ...loadJson(userKey(auth.username), {}), phone: data.phone });
      notify('登录成功');
    } catch (error) {
      notify(error.message);
    }
  };
  const submitOrder = () => {
    if (!requireLogin()) return;
    if (!cartItems.length) return notify('购物车为空');
    const shippingFee = cartCount >= 5 ? 0 : 3000;
    const order = {
      id: `SB-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      username: activeUser,
      customerPhone: saved.phone,
      items: cartItems.map(({ product, qty }) => ({ id: product.id, brand: product.brand, name: product.displayTitle, spec: product.displaySpec, price: product.price, qty })),
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      address: saved.addresses[0] || null,
      payerName: '',
      status: statuses[0],
      transferConfirmed: false,
      createdAt: new Date().toISOString(),
    };
    saveJson(ordersKey, [order, ...loadJson(ordersKey, [])]);
    setSaved((old) => ({ ...old, cart: {} }));
    notify('订单已提交');
    setPanel('profile');
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
      {panel === 'profile' && <Panel title="个人主页" onClose={() => setPanel('')}><Profile username={activeUser} saved={saved} setSaved={setSaved} notify={notify} logout={() => setActiveUser('')} /></Panel>}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function AuthForm({ auth, setAuth, onSendCode, onSubmit, sending }) {
  return (
    <form className="auth-box" onSubmit={onSubmit}>
      <input value={auth.username} onChange={(e) => setAuth((old) => ({ ...old, username: e.target.value }))} placeholder="用户名" />
      <div className="phone-fields">
        <input value={auth.countryCode} onChange={(e) => setAuth((old) => ({ ...old, countryCode: e.target.value }))} />
        <input value={auth.phoneNumber} onChange={(e) => setAuth((old) => ({ ...old, phoneNumber: e.target.value }))} placeholder="手机号" />
      </div>
      <div className="code-fields">
        <input value={auth.code} onChange={(e) => setAuth((old) => ({ ...old, code: e.target.value }))} placeholder="验证码" />
        <button type="button" onClick={onSendCode} disabled={sending}>{sending ? '发送中' : '发送'}</button>
      </div>
      <button type="submit">登录</button>
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
  const [orders, setOrders] = useState(() => loadJson(ordersKey, []));
  const [open, setOpen] = useState('');
  const update = (id, patch) => {
    setOrders((old) => {
      const next = old.map((order) => (order.id === id ? { ...order, ...patch } : order));
      saveJson(ordersKey, next);
      return next;
    });
  };
  return (
    <div className="admin-page">
      <header className="admin-topbar"><a className="admin-brand" href="/">skinbeauty</a><nav><a href="/">商城首页</a><a href="/admin">后台管理</a></nav></header>
      <main className="admin-shell">
        <header className="admin-header"><h1>客户订单</h1><p>共 {orders.length} 件订单</p></header>
        <section className="admin-order-list">
          {orders.length ? orders.map((order) => (
            <article className="admin-list-order" key={order.id}>
              <div className="admin-list-row"><span>{order.status}</span><strong>{order.id}</strong><span>{order.username}</span><span>{money(order.total)}</span><button onClick={() => setOpen(open === order.id ? '' : order.id)}>详情</button></div>
              {open === order.id && <div className="admin-order-detail"><div>{order.items.map((item) => <p key={item.id}>{item.name} x {item.qty}</p>)}</div><label><input type="checkbox" checked={order.transferConfirmed} onChange={(e) => update(order.id, { transferConfirmed: e.target.checked })} /> 确认已转账</label><select value={order.status} onChange={(e) => update(order.id, { status: e.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>}
            </article>
          )) : <div className="empty-state">暂无订单</div>}
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
