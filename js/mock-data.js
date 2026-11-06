'use strict';

// ข้อมูลตัวอย่าง (โหมดทดลอง) — ตัวเลขราคา/NAV ทั้งหมดเป็นค่าสมมติ
// แต่ละสินทรัพย์เก็บเฉพาะยอดปัจจุบัน: จำนวนที่ถือครอง × ราคา/NAV (ต้นทุนรวมเป็นข้อมูลเสริม ไม่บังคับ)
const MOCK = (() => {
  const holdings = [];
  const H = (h) => holdings.push({ currency: 'THB', priceDate: AS_OF, extra: {}, note: '', cost: null, ...h });

  H({ id: 'h1', type: 'SSF', name: 'SCB SET Index Fund (SSF)', symbol: 'SCBSET-SSF', platform: 'SCB Easy', units: 15800, price: 10.8512, cost: 155559, extra: { fundHouse: 'SCBAM', riskLevel: '6' } });
  H({ id: 'h2', type: 'SSF', name: 'กองทุนหุ้นสหรัฐ S&P500 (SSF)', symbol: 'US500-SSF', platform: 'Finnomena', units: 7900, price: 16.4231, cost: 104265, extra: { fundHouse: 'KAsset', riskLevel: '6' } });
  H({ id: 'h3', type: 'RMF', name: 'SCB Global Equity RMF', symbol: 'SCBRMGLOB', platform: 'SCB Easy', units: 25500, price: 14.7318, cost: 328200, extra: { fundHouse: 'SCBAM', riskLevel: '6' } });
  H({ id: 'h4', type: 'RMF', name: 'กองทุนตราสารหนี้ RMF', symbol: 'FIXED-RMF', platform: 'Finnomena', units: 14000, price: 12.3105, cost: 168400, extra: { fundHouse: 'KAsset', riskLevel: '4' } });
  H({ id: 'h5', type: 'THAIESG', name: 'SCB Thai ESG Equity', symbol: 'SCBTHAIESG', platform: 'SCB Easy', units: 23500, price: 9.6215, cost: 229150, extra: { fundHouse: 'SCBAM', riskLevel: '6' } });
  H({ id: 'h6', type: 'MF', name: 'กองทุนหุ้นเซมิคอนดักเตอร์', symbol: 'SCBSEMI(A)', platform: 'SCB Easy', units: 6500, price: 18.9530, cost: 90918.75, extra: { fundHouse: 'SCBAM', riskLevel: '7', dividendPolicy: 'ไม่จ่ายปันผล' } });
  H({ id: 'h7', type: 'MF', name: 'กองทุนตลาดเงิน', symbol: 'KT-MONEY', platform: 'Finnomena', units: 13000, price: 15.1120, cost: 193050, extra: { fundHouse: 'KTAM', riskLevel: '1', dividendPolicy: 'ไม่จ่ายปันผล' } });
  H({ id: 'h8', type: 'PVD', name: 'กองทุนสำรองเลี้ยงชีพ – แผนผสม', symbol: 'PVD-MIX30', platform: 'สำนักงาน HR', units: 59942.1842, price: 13.4512, cost: 777804.6,
    extra: { employer: 'บริษัท ตัวอย่าง จำกัด', plan: 'แผนผสมหุ้นไม่เกิน 30%' } });
  H({ id: 'h9', type: 'STOCK_TH', name: 'ปตท.', symbol: 'PTT', platform: 'Streaming', units: 3000, price: 34.50, cost: 101679.2, extra: { market: 'SET', sector: 'พลังงาน' } });
  H({ id: 'h10', type: 'STOCK_TH', name: 'แอดวานซ์ อินโฟร์ เซอร์วิส', symbol: 'ADVANC', platform: 'Streaming', units: 300, price: 312.00, cost: 66116.6, extra: { market: 'SET', sector: 'เทคโนโลยี' } });
  H({ id: 'h11', type: 'STOCK_TH', name: 'ซีพี ออลล์', symbol: 'CPALL', platform: 'InnovestX', units: 1500, price: 52.25, cost: 87905, extra: { market: 'SET', sector: 'พาณิชย์' } });
  H({ id: 'h12', type: 'STOCK_US', name: 'NVIDIA Corp.', symbol: 'NVDA', platform: 'Dime!', currency: 'USD', units: 30, price: 186.40, cost: 2109, extra: { exchange: 'NASDAQ', sector: 'Semiconductors' } });
  H({ id: 'h13', type: 'STOCK_US', name: 'Vanguard S&P 500 ETF', symbol: 'VOO', platform: 'Dime!', currency: 'USD', units: 9, price: 612.30, cost: 4057, extra: { exchange: 'NYSE Arca', sector: 'ETF' } });
  H({ id: 'h14', type: 'CRYPTO', name: 'Bitcoin', symbol: 'BTC', platform: 'Bitkub', units: 0.07, price: 3450000, cost: 126200, extra: { wallet: 'Bitkub' } });
  H({ id: 'h15', type: 'CRYPTO', name: 'Ethereum', symbol: 'ETH', platform: 'Bitkub', units: 0.8, price: 115000, cost: 68000, extra: { wallet: 'Bitkub' } });
  H({ id: 'h16', type: 'GOLD', name: 'ทองคำแท่ง 96.5%', symbol: 'GOLD-BAR', platform: 'ร้านทอง', units: 3, price: 61500, cost: 100800, extra: { goldForm: 'ทองคำแท่ง', purity: '96.5%' } });
  H({ id: 'h17', type: 'GOLD', name: 'Gold Wallet', symbol: 'GOLD-ONLINE', platform: 'SCB Easy', units: 1.25, price: 61500, cost: 59500, extra: { goldForm: 'Gold Wallet / ออนไลน์', purity: '96.5%' } });
  H({ id: 'h18', type: 'BOND', name: 'หุ้นกู้ ตัวอย่าง 3.40% ครบกำหนด 2572', symbol: 'XYZ294A', platform: 'SCB Easy', units: 200, price: 1008, cost: 200000,
    extra: { issuer: 'บริษัท ตัวอย่าง จำกัด (มหาชน)', couponRate: 3.4, maturityDate: '2029-07-01', rating: 'A' } });
  H({ id: 'h19', type: 'DEPOSIT', name: 'ฝากประจำ 12 เดือน', symbol: '', platform: 'SCB Easy', balance: 505250, cost: 500000,
    extra: { accountType: 'ฝากประจำ', interestRate: 1.4, maturityDate: '2027-02-01' } });
  H({ id: 'h20', type: 'DEPOSIT', name: 'ออมทรัพย์ดิจิทัล', symbol: '', platform: 'KKP', balance: 182430, extra: { accountType: 'ออมทรัพย์ดิจิทัล', interestRate: 1.5 } });
  H({ id: 'h21', type: 'OTHER', name: 'ประกันสะสมทรัพย์ 15/8 (มูลค่าเวนคืน)', symbol: '', platform: 'บริษัทประกัน', units: 1, price: 248000, cost: 300000,
    extra: { category: 'ประกันชีวิต (มูลค่าเวนคืน)' } });

  return {
    holdings,
    profile: { displayName: 'คุณสมชาย (Demo)' },
    fx: { THB: 1, USD: 33.5 },
  };
})();
