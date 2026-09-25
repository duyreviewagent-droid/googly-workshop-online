// Googly Workshop: everything both the game server and the browser need to agree on.
// Products, fixtures, the store floor plan, prices, staff, upgrades, events and the clock.

export const DAYS = 30;                 // one month
export const DAY_SEC = 60;              // one in-game day = one real minute → 30 minutes a month
export const OPEN_H = 8, CLOSE_H = 20;  // shop hours
export const START_CASH = 2500;
export const RENT = 60;                 // per day
export const POWER = 10;                // per fridge/freezer per day
export const BOX = 24;                  // units per wholesale box
export const TRUCK_SEC = 6;             // order → boxes in the stockroom
export const CARRY = 48;                // a trolley holds two boxes
export const STORE_W = 16, STORE_D = 20, STORE_GAP = 22;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** game-clock helpers: t = seconds into the day */
export const hourAt = t => 7 + (t / DAY_SEC) * 14;               // 7:00 → 21:00
export const isOpen = t => { const h = hourAt(t); return h >= OPEN_H && h < CLOSE_H; };
export function clockText(t) {
  const h = hourAt(t), hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5;
  const ap = hh >= 12 ? 'PM' : 'AM', h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}

// ------------------------------------------------------------------ products
// cost = normal wholesale price per unit, ref = the price shoppers expect to pay.
// kind = which fixture it lives on. demand = how often it lands on a shopping list.
// spoil = share of stock that goes bad overnight (fresh food).
export const PRODUCTS = [
  { id: 'banana', name: 'Bananas', kind: 'produce', cost: 0.44, ref: 1.20, demand: 1.3, spoil: 0.14, color: '#ffd23a', art: 'banana' },
  { id: 'apple', name: 'Apples', kind: 'produce', cost: 0.62, ref: 1.50, demand: 1.1, spoil: 0.08, color: '#e8352a', art: 'apple' },
  { id: 'carrot', name: 'Carrots', kind: 'produce', cost: 0.35, ref: 1.00, demand: 0.8, spoil: 0.08, color: '#ff8a1c', art: 'carrot' },
  { id: 'tomato', name: 'Tomatoes', kind: 'produce', cost: 0.70, ref: 1.80, demand: 0.9, spoil: 0.14, color: '#ff3b30', art: 'tomato' },
  { id: 'milk', name: 'Milk', kind: 'fridge', cost: 1.58, ref: 3.50, demand: 1.4, spoil: 0.08, color: '#f4f7ff', art: 'milk' },
  { id: 'eggs', name: 'Eggs', kind: 'fridge', cost: 1.76, ref: 4.00, demand: 1.1, spoil: 0.05, color: '#f5deb3', art: 'eggs' },
  { id: 'cheese', name: 'Cheese', kind: 'fridge', cost: 2.64, ref: 5.50, demand: 0.8, spoil: 0.04, color: '#ffc21a', art: 'cheese' },
  { id: 'chicken', name: 'Chicken', kind: 'fridge', cost: 3.96, ref: 8.00, demand: 0.9, spoil: 0.12, color: '#f0b39a', art: 'chicken' },
  { id: 'icecream', name: 'Ice Cream', kind: 'freezer', cost: 2.64, ref: 6.00, demand: 0.8, spoil: 0, color: '#ff9ed2', art: 'icecream' },
  { id: 'pizza', name: 'Frozen Pizza', kind: 'freezer', cost: 3.08, ref: 7.00, demand: 0.8, spoil: 0, color: '#d83a2a', art: 'pizza' },
  { id: 'bread', name: 'Bread', kind: 'shelf', cost: 1.06, ref: 3.00, demand: 1.3, spoil: 0.1, color: '#c98a3e', art: 'bread' },
  { id: 'cereal', name: 'Cereal', kind: 'shelf', cost: 1.76, ref: 4.50, demand: 1.0, spoil: 0, color: '#2f7bff', art: 'cereal' },
  { id: 'chips', name: 'Chips', kind: 'shelf', cost: 1.23, ref: 3.50, demand: 1.1, spoil: 0, color: '#ffcc00', art: 'chips' },
  { id: 'soda', name: 'Soda', kind: 'shelf', cost: 0.79, ref: 2.50, demand: 1.2, spoil: 0, color: '#e0162b', art: 'soda' },
  { id: 'cookies', name: 'Cookies', kind: 'shelf', cost: 1.58, ref: 4.00, demand: 0.9, spoil: 0, color: '#7a4a22', art: 'cookies' },
  { id: 'coffee', name: 'Coffee', kind: 'shelf', cost: 3.96, ref: 9.00, demand: 0.7, spoil: 0, color: '#4a2a14', art: 'coffee' },
  { id: 'pasta', name: 'Pasta', kind: 'shelf', cost: 0.70, ref: 2.00, demand: 0.9, spoil: 0, color: '#ffe08a', art: 'pasta' },
  { id: 'tp', name: 'Toilet Paper', kind: 'shelf', cost: 3.08, ref: 7.00, demand: 0.7, spoil: 0, color: '#eef2f7', art: 'tp' },
];
export const PROD = Object.fromEntries(PRODUCTS.map((p, i) => [p.id, { ...p, i }]));

// ------------------------------------------------------------------ fixtures
export const FIXTURES = {
  produce: { name: 'Produce Stand', price: 250, cap: 60, power: false, w: 2.6, d: 1.4, h: 0.95 },
  shelf: { name: 'Shelf', price: 350, cap: 48, power: false, w: 1.0, d: 4.0, h: 1.8 },
  fridge: { name: 'Fridge', price: 650, cap: 40, power: true, w: 3.0, d: 0.9, h: 2.0 },
  freezer: { name: 'Freezer', price: 700, cap: 40, power: true, w: 3.0, d: 0.9, h: 1.0 },
};

// Floor plan, in store-local metres: x ∈ [-8, 8], z ∈ [-20, 0]. z = 0 is the glass front on the street.
// Every slot has two sections (A, B), each holding one product. `stand` = where a shopper stands to grab from it.
export const SLOTS = [
  { kind: 'produce', x: 0.4, z: -5.6, stand: [[-0.25, -4.3], [1.05, -4.3]] },
  { kind: 'produce', x: 4.6, z: -5.6, stand: [[3.95, -4.3], [5.25, -4.3]] },
  { kind: 'shelf', x: -4.5, z: -10.5, stand: [[-5.45, -10.5], [-3.55, -10.5]] },
  { kind: 'shelf', x: -1.5, z: -10.5, stand: [[-2.45, -10.5], [-0.55, -10.5]] },
  { kind: 'shelf', x: 1.5, z: -10.5, stand: [[0.55, -10.5], [2.45, -10.5]] },
  { kind: 'shelf', x: 4.5, z: -10.5, stand: [[3.55, -10.5], [5.45, -10.5]] },
  { kind: 'fridge', x: -4.3, z: -16.5, stand: [[-5.05, -15.3], [-3.55, -15.3]] },
  { kind: 'fridge', x: -1.1, z: -16.5, stand: [[-1.85, -15.3], [-0.35, -15.3]] },
  { kind: 'freezer', x: 2.1, z: -16.5, stand: [[1.35, -15.3], [2.85, -15.3]] },
  { kind: 'freezer', x: 5.3, z: -16.5, stand: [[4.55, -15.3], [6.05, -15.3]] },
];
// which side of a slot each section is drawn on (for shelves: the two long faces; others: left/right halves)
export const START_SLOTS = [
  { slot: 0, secs: ['banana', 'apple'] },
  { slot: 2, secs: ['bread', 'cereal'] },
  { slot: 3, secs: ['chips', 'soda'] },
  { slot: 6, secs: ['milk', 'eggs'] },
];
export const DOOR = { x0: 2.5, x1: 5.5 };           // glass sliding doors in the front wall
export const DOOR_IN = [4, -1.2], DOOR_OUT = [4, 1.6];
// checkout lanes: lane 1 is always open, lane 2 is an upgrade
export const TILLS = [
  { x: -4.6, z: -2.3, w: 1.0, d: 2.4, cashier: [-5.7, -2.5], pay: [-3.55, -2.5] },
  { x: -4.6, z: -5.9, w: 1.0, d: 2.4, cashier: [-5.7, -6.1], pay: [-3.55, -6.1] },
];
export const REGISTER = TILLS[0], CASHIER_SPOT = TILLS[0].cashier, PAY_SPOT = TILLS[0].pay;
export const QUEUE = (() => { const q = []; for (let i = 1; i < 7; i++) q.push([-3.55 + i * 0.85, -2.5]); for (let i = 0; i < 7; i++) q.push([1.5 - i * 0.85, -3.5]); return q; })();
export const PARTITION_Z = -17.2;                  // stockroom wall
export const STOCK_DOOR = { x0: -7.9, x1: -6.3 };   // gap in the stockroom wall (staff only)
export const STOCK_RACK = [-3.2, -18.25];          // where you stand to pick up boxes
export const STOCK_RACK_BOX = { x: -3.2, z: -19.35, w: 6.4, d: 1.1 };
export const BACK_DOOR = { x0: 4, x1: 6.2 };
export const TRUCK_SPOT = [5.1, -23.5];

/** Things that stop feet (store-local AABBs: x, z, w, d). Walls are added separately. */
export function solidBoxes() {
  const b = [];
  SLOTS.forEach(s => { const f = FIXTURES[s.kind]; b.push({ x: s.x, z: s.z, w: f.w, d: f.d, slot: true }); });
  for (const t of TILLS) b.push({ x: t.x, z: t.z, w: t.w, d: t.d });
  b.push(STOCK_RACK_BOX);
  return b;
}
/** Walls as thin AABBs, store-local. `door` gaps are left open. */
export function wallBoxes() {
  const T = 0.3, W = STORE_W / 2, D = STORE_D, out = [];
  // front glass with the door gap
  out.push({ x: (-W + DOOR.x0) / 2, z: 0, w: DOOR.x0 + W, d: T });
  out.push({ x: (DOOR.x1 + W) / 2, z: 0, w: W - DOOR.x1, d: T });
  // sides
  out.push({ x: -W, z: -D / 2, w: T, d: D }); out.push({ x: W, z: -D / 2, w: T, d: D });
  // back wall with the delivery door
  out.push({ x: (-W + BACK_DOOR.x0) / 2, z: -D, w: BACK_DOOR.x0 + W, d: T });
  out.push({ x: (BACK_DOOR.x1 + W) / 2, z: -D, w: W - BACK_DOOR.x1, d: T });
  // stockroom partition with its door
  out.push({ x: (STOCK_DOOR.x1 + W) / 2, z: PARTITION_Z, w: W - STOCK_DOOR.x1, d: T });
  out.push({ x: (-W + STOCK_DOOR.x0) / 2, z: PARTITION_Z, w: STOCK_DOOR.x0 + W, d: T });
  return out;
}
export const storeX = i => (i - 1.5) * STORE_GAP;

// ------------------------------------------------------------------ staff & upgrades
export const STAFF = {
  cashier: { name: 'Cashier', wage: 45, desc: 'Scans shoppers at the till all day', color: '#2f7bff' },
  stocker: { name: 'Stocker', wage: 40, desc: 'Carries boxes from the stockroom to empty shelves', color: '#34c759' },
  cashier2: { name: '2nd Cashier', wage: 45, desc: 'Runs checkout lane 2 (buy the lane first)', color: '#5e5ce6', needs: 'till2' },
  janitor: { name: 'Janitor', wage: 25, desc: 'Mops up spills so shoppers stay happy', color: '#ff9500' },
};
export const UPGRADES = [
  { id: 'flyers', name: 'Flyers', price: 80, days: 1, desc: '+35% shoppers choose you today', ad: 0.35 },
  { id: 'radio', name: 'Radio Ad', price: 260, days: 3, desc: '+45% shoppers for 3 days', ad: 0.45 },
  { id: 'till2', name: 'Checkout Lane 2', price: 600, perm: true, desc: 'A second till: hire a 2nd cashier or run it yourself' },
  { id: 'scanner', name: 'Laser Scanner', price: 300, perm: true, desc: 'Checkout scans 50% faster' },
  { id: 'lights', name: 'Fancy Lights', price: 450, perm: true, desc: 'Shoppers like your store 12% more' },
  { id: 'speakers', name: 'Store Music', price: 200, perm: true, desc: 'Shoppers wait 40% longer in line' },
  { id: 'sign', name: 'Neon Sign', price: 350, perm: true, desc: '+10% shoppers walk in from the street' },
];
export const UP = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// ------------------------------------------------------------------ owners
export const CPUS = [
  { name: 'RICK', color: '#e8452c', style: 'cheap', store: "RICK'S DISCOUNT", blurb: 'Cheapest prices in town. Always.' },
  { name: 'GUS', color: '#8a5a2b', style: 'fancy', store: "GUS'S GOURMET", blurb: 'Fancy store, fancy prices.' },
  { name: 'SUNNY', color: '#ffc53a', style: 'fair', store: 'SUNNY MART', blurb: 'Fair prices, friendly faces.' },
  { name: 'VIOLET', color: '#9b59ff', style: 'shark', store: 'VIOLET VALUE', blurb: 'Watches your prices. Undercuts them.' },
];
export const DIFF = ['Easy', 'Normal', 'Hard'];
export const PLAYER_COLORS = ['#9aa0a6', '#2f7bff', '#34c759', '#ff3b30', '#ff6fb5', '#00c7be', '#ff9500', '#f2f2f7', '#3a3a3c', '#bf5af2'];

// ------------------------------------------------------------------ daily news
export const EVENTS = [
  { id: 'heat', title: 'HEATWAVE!', text: 'Everyone wants ice cream and soda today.', demand: { icecream: 2.4, soda: 1.9 }, accept: { icecream: 1.25, soda: 1.2 } },
  { id: 'eggs', title: 'EGG SHORTAGE', text: 'Egg wholesale price is way up — but shoppers will pay more too.', cost: { eggs: 1.8 }, accept: { eggs: 1.5 }, demand: { eggs: 1.3 } },
  { id: 'payday', title: 'PAYDAY', text: 'Wallets are full. 40% more shoppers today.', crowd: 1.4, acceptAll: 1.1 },
  { id: 'rain', title: 'RAINY DAY', text: 'Fewer shoppers out in the rain.', crowd: 0.72, rain: true },
  { id: 'health', title: 'HEALTH CRAZE', text: 'A googly influencer says veggies are cool. Produce flies off the shelves.', demand: { banana: 1.8, apple: 1.8, carrot: 2.2, tomato: 1.8, chips: 0.6, cookies: 0.6 } },
  { id: 'coffee', title: 'COFFEE CRISIS', text: 'Bad harvest: coffee costs double at wholesale.', cost: { coffee: 2 }, accept: { coffee: 1.4 } },
  { id: 'game', title: 'BIG GAME TONIGHT', text: 'Chips, soda and pizza — everyone is hosting a party.', demand: { chips: 2, soda: 1.8, pizza: 2.2 } },
  { id: 'sale', title: 'FARM SURPLUS', text: 'Farmers have too much fruit. Produce is half price at wholesale.', cost: { banana: 0.5, apple: 0.5, carrot: 0.5, tomato: 0.5 } },
  { id: 'bake', title: 'BAKE-OFF WEEK', text: 'Everyone is baking: eggs, milk and cookies are hot.', demand: { eggs: 1.7, milk: 1.5, cookies: 1.6 } },
  { id: 'tp', title: 'TOILET PAPER PANIC', text: 'A rumour started. Everybody wants toilet paper NOW.', demand: { tp: 4 }, accept: { tp: 1.7 } },
  { id: 'bbq', title: 'BBQ SEASON', text: 'Chicken and bread are grill-ready favourites.', demand: { chicken: 2, bread: 1.5 } },
  { id: 'quiet', title: 'QUIET DAY', text: 'Nothing much happening in Googlyville.', crowd: 1 },
];
export const FEAST_DAY = 26;  // Googlygiving: the busiest day of the month
export const FEAST = { id: 'feast', title: 'GOOGLYGIVING!', text: 'The biggest shopping day of the year. Double the shoppers!', crowd: 2, demand: { chicken: 2.5, bread: 1.8, cookies: 1.8, milk: 1.4 }, acceptAll: 1.1 };

export const money = v => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const money2 = v => (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
