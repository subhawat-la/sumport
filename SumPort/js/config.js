'use strict';

// วันที่ปัจจุบันของเครื่อง (YYYY-MM-DD ตามเวลาท้องถิ่น)
const AS_OF = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

// หมวดตามงบแสดงฐานะการเงินส่วนบุคคล (ใช้จัดกลุ่มในหน้าภาพรวมและไฟล์ Excel)
const BS_GROUPS = [
  { key: 'LIQUID', name: 'สินทรัพย์สภาพคล่อง' },
  { key: 'INVEST', name: 'สินทรัพย์เพื่อการลงทุน' },
  { key: 'RETIRE', name: 'กองทุนเพื่อการเกษียณและการลงทุนระยะยาว' },
  { key: 'PERSONAL', name: 'สินทรัพย์ส่วนตัวและอื่นๆ' },
];

const ASSET_TYPES = [
  { key: 'SSF', label: 'SSF', name: 'กองทุนรวมเพื่อการออม (SSF)', icon: '🛡️', color: '#6366F1', mode: 'unit', unitLabel: 'หน่วย', priceLabel: 'NAV', vol: 0.04, bs: 'RETIRE',
    desc: 'กองทุนรวมเพื่อการออม', hint: 'กรอกจำนวนหน่วยคงเหลือและ NAV ล่าสุดจากแอปหรือ statement ของ บลจ.' },
  { key: 'RMF', label: 'RMF', name: 'กองทุนรวมเพื่อการเลี้ยงชีพ (RMF)', icon: '🏖️', color: '#8B5CF6', mode: 'unit', unitLabel: 'หน่วย', priceLabel: 'NAV', vol: 0.04, bs: 'RETIRE',
    desc: 'กองทุนเพื่อการเลี้ยงชีพ', hint: 'กรอกจำนวนหน่วยคงเหลือและ NAV ล่าสุดจากแอปหรือ statement ของ บลจ.' },
  { key: 'THAIESG', label: 'Thai ESG', name: 'กองทุน Thai ESG', icon: '🌱', color: '#10B981', mode: 'unit', unitLabel: 'หน่วย', priceLabel: 'NAV', vol: 0.035, bs: 'RETIRE',
    desc: 'กองทุน Thai ESG / ThaiESGX', hint: 'กรอกจำนวนหน่วยคงเหลือและ NAV ล่าสุดจากแอปหรือ statement ของ บลจ.' },
  { key: 'MF', label: 'กองทุนรวม', name: 'กองทุนรวมทั่วไป', icon: '📊', color: '#3B82F6', mode: 'unit', unitLabel: 'หน่วย', priceLabel: 'NAV', vol: 0.05, bs: 'INVEST',
    desc: 'กองทุนหุ้น ตราสารหนี้ ตลาดเงิน ฯลฯ', hint: 'กรอก NAV ล่าสุดจากเว็บไซต์ บลจ. หรือแอปที่ใช้ซื้อ' },
  { key: 'PVD', label: 'PVD', name: 'กองทุนสำรองเลี้ยงชีพ (PVD)', icon: '🏢', color: '#14B8A6', mode: 'unit', unitLabel: 'หน่วย', priceLabel: 'NAV', vol: 0.015, bs: 'RETIRE',
    desc: 'เงินสะสม + เงินสมทบจากนายจ้าง', hint: 'กรอกจำนวนหน่วยคงเหลือและ NAV จาก statement ล่าสุดของกองทุน' },
  { key: 'STOCK_TH', label: 'หุ้นไทย', name: 'หุ้นไทยรายตัว', icon: '📈', color: '#F59E0B', mode: 'unit', unitLabel: 'หุ้น', priceLabel: 'ราคา', vol: 0.06, unitDecimals: 0, bs: 'INVEST',
    desc: 'หุ้นใน SET / mai', hint: 'ใช้ราคาปิดล่าสุดจาก SET หรือแอปโบรกเกอร์' },
  { key: 'STOCK_US', label: 'หุ้นต่างประเทศ', name: 'หุ้น / ETF ต่างประเทศ', icon: '🌎', color: '#EF4444', mode: 'unit', unitLabel: 'หุ้น', priceLabel: 'ราคา', vol: 0.07, defaultCurrency: 'USD', unitDecimals: 6, bs: 'INVEST',
    desc: 'หุ้น US, ETF, หุ้นเศษส่วน', hint: 'มูลค่าจะแปลงเป็นบาทด้วยอัตราแลกเปลี่ยนปัจจุบัน (ตั้งค่าได้ที่มุมขวาบน)' },
  { key: 'CRYPTO', label: 'คริปโต', name: 'สินทรัพย์ดิจิทัล', icon: '₿', color: '#F97316', mode: 'unit', unitLabel: 'เหรียญ', priceLabel: 'ราคา', vol: 0.15, unitDecimals: 8, bs: 'INVEST',
    desc: 'BTC, ETH และเหรียญอื่นๆ', hint: 'รองรับทศนิยมได้ถึง 8 ตำแหน่ง' },
  { key: 'GOLD', label: 'ทองคำ', name: 'ทองคำ', icon: '🥇', color: '#EAB308', mode: 'unit', unitLabel: 'บาททองคำ', priceLabel: 'ราคารับซื้อคืน/บาท', vol: 0.04, unitDecimals: 4, bs: 'INVEST',
    desc: 'ทองแท่ง ทองรูปพรรณ Gold Wallet', hint: 'ใช้ราคารับซื้อคืน (ราคาขายออก) ของสมาคมค้าทองคำเพื่อประเมินมูลค่า' },
  { key: 'BOND', label: 'หุ้นกู้/พันธบัตร', name: 'หุ้นกู้ / พันธบัตร', icon: '📜', color: '#64748B', mode: 'unit', unitLabel: 'หน่วย', priceLabel: 'ราคา/หน่วย', vol: 0.005, bs: 'INVEST',
    desc: 'หุ้นกู้เอกชน พันธบัตรรัฐบาล', hint: 'โดยทั่วไปหุ้นกู้มีมูลค่าที่ตราไว้ 1,000 บาท/หน่วย' },
  { key: 'DEPOSIT', label: 'เงินฝาก', name: 'เงินฝากธนาคาร', icon: '🏦', color: '#0EA5E9', mode: 'amount', vol: 0.001, bs: 'LIQUID',
    desc: 'ออมทรัพย์ ฝากประจำ FCD', hint: 'กรอกยอดเงินคงเหลือปัจจุบันของบัญชี' },
  { key: 'OTHER', label: 'อื่นๆ', name: 'สินทรัพย์อื่นๆ', icon: '📦', color: '#A3A3A3', mode: 'unit', unitLabel: 'หน่วย', priceLabel: 'มูลค่า/หน่วย', vol: 0.03, bs: 'PERSONAL',
    desc: 'ประกันสะสมทรัพย์ อสังหาฯ รถยนต์ ของสะสม', hint: 'เช่น ประกันชีวิตให้กรอกมูลค่าเวนคืน, อสังหาฯ ให้กรอกราคาประเมิน โดยใส่จำนวน 1 หน่วย' },
];

const FUND_EXTRA = [
  { key: 'fundHouse', label: 'บลจ.', type: 'text', placeholder: 'เช่น SCBAM, KAsset' },
  { key: 'riskLevel', label: 'ระดับความเสี่ยง', type: 'select', options: ['', '1', '2', '3', '4', '5', '6', '7', '8'] },
];

const EXTRA_FIELDS = {
  SSF: FUND_EXTRA,
  RMF: FUND_EXTRA,
  THAIESG: FUND_EXTRA,
  MF: [...FUND_EXTRA, { key: 'dividendPolicy', label: 'นโยบายปันผล', type: 'select', options: ['', 'ไม่จ่ายปันผล', 'จ่ายปันผล', 'ขายคืนอัตโนมัติ'] }],
  PVD: [
    { key: 'employer', label: 'นายจ้าง', type: 'text' },
    { key: 'plan', label: 'แผนการลงทุน', type: 'text', placeholder: 'เช่น แผนผสมหุ้นไม่เกิน 30%' },
  ],
  STOCK_TH: [
    { key: 'market', label: 'ตลาด', type: 'select', options: ['', 'SET', 'mai'] },
    { key: 'sector', label: 'กลุ่มอุตสาหกรรม', type: 'text' },
  ],
  STOCK_US: [
    { key: 'exchange', label: 'ตลาด', type: 'select', options: ['', 'NASDAQ', 'NYSE', 'NYSE Arca', 'อื่นๆ'] },
    { key: 'sector', label: 'กลุ่มอุตสาหกรรม', type: 'text' },
  ],
  CRYPTO: [{ key: 'wallet', label: 'Wallet / Exchange', type: 'text' }],
  GOLD: [
    { key: 'goldForm', label: 'รูปแบบ', type: 'select', options: ['', 'ทองคำแท่ง', 'ทองรูปพรรณ', 'Gold Wallet / ออนไลน์', 'Gold Futures'] },
    { key: 'purity', label: 'ความบริสุทธิ์', type: 'select', options: ['', '96.5%', '99.99%'] },
  ],
  BOND: [
    { key: 'issuer', label: 'ผู้ออก', type: 'text' },
    { key: 'couponRate', label: 'อัตราดอกเบี้ย (%/ปี)', type: 'number' },
    { key: 'maturityDate', label: 'วันครบกำหนด', type: 'date' },
    { key: 'rating', label: 'Credit rating', type: 'text' },
  ],
  DEPOSIT: [
    { key: 'accountType', label: 'ประเภทบัญชี', type: 'select', options: ['', 'ออมทรัพย์', 'ออมทรัพย์ดิจิทัล', 'ฝากประจำ', 'เงินฝากสกุลต่างประเทศ (FCD)'] },
    { key: 'interestRate', label: 'อัตราดอกเบี้ย (%/ปี)', type: 'number' },
    { key: 'maturityDate', label: 'วันครบกำหนด', type: 'date' },
  ],
  OTHER: [{ key: 'category', label: 'หมวดหมู่', type: 'select', options: ['', 'ประกันชีวิต (มูลค่าเวนคืน)', 'อสังหาริมทรัพย์', 'ยานพาหนะ', 'ของสะสม / เครื่องประดับ', 'อื่นๆ'] }],
};

const PLATFORMS = ['SCB Easy', 'SCBAM', 'Finnomena', 'Dime!', 'Streaming', 'InnovestX', 'Bitkub', 'Binance TH', 'KKP', 'ร้านทอง', 'สำนักงาน HR'];
