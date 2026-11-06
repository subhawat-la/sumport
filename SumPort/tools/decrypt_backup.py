#!/usr/bin/env python3
"""ถอดรหัสไฟล์สำรอง FinancialLog (.flbak) โดยไม่ต้องใช้แอป

ไฟล์สำรองใช้มาตรฐานเปิด: PBKDF2-HMAC-SHA256 -> AES-256-GCM (ข้อมูลเป็น JSON)
สคริปต์นี้มีไว้เพื่อให้เปิดข้อมูลพอร์ตได้ในระยะยาว แม้แอปจะไม่มีให้ใช้งานแล้ว

วิธีใช้:
    pip install cryptography
    python decrypt_backup.py FinancialLog-backup-2026-11-05.flbak            # แสดงสรุป
    python decrypt_backup.py FinancialLog-backup-2026-11-05.flbak -o data.json  # บันทึก JSON
"""
import argparse
import base64
import getpass
import json
import sys

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def decrypt(backup: dict, password: str) -> dict:
    if not backup.get("encrypted"):
        return backup["payload"]
    kdf = backup["kdf"]
    if kdf.get("name") != "PBKDF2" or kdf.get("hash") != "SHA-256":
        raise ValueError(f"ไม่รองรับ KDF: {kdf}")
    key = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=base64.b64decode(kdf["salt"]),
        iterations=int(kdf["iterations"]),
    ).derive(password.encode("utf-8"))
    iv = base64.b64decode(backup["cipher"]["iv"])
    plaintext = AESGCM(key).decrypt(iv, base64.b64decode(backup["data"]), None)
    return json.loads(plaintext.decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="ถอดรหัสไฟล์สำรอง FinancialLog")
    parser.add_argument("file", help="ไฟล์ .flbak")
    parser.add_argument("-o", "--output", help="บันทึกข้อมูลที่ถอดรหัสแล้วเป็นไฟล์ JSON")
    parser.add_argument("-p", "--password", help="รหัสผ่าน (ถ้าไม่ระบุจะถามแบบซ่อนตัวอักษร)")
    args = parser.parse_args()

    with open(args.file, encoding="utf-8") as f:
        backup = json.load(f)
    if backup.get("app") != "FinancialLog" or backup.get("kind") != "backup":
        print("ไฟล์นี้ไม่ใช่ไฟล์สำรองของ FinancialLog", file=sys.stderr)
        return 1

    password = ""
    if backup.get("encrypted"):
        password = args.password or getpass.getpass("รหัสผ่านไฟล์สำรอง: ")
    try:
        data = decrypt(backup, password)
    except Exception:
        print("ถอดรหัสไม่สำเร็จ: รหัสผ่านไม่ถูกต้องหรือไฟล์เสียหาย", file=sys.stderr)
        return 2

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"บันทึกแล้ว: {args.output}")
    else:
        print(f"สร้างเมื่อ: {backup.get('createdAt')}  schema v{data.get('schemaVersion') or 1}")
        print(f"สินทรัพย์ {len(data['holdings'])} รายการ")
        if data.get("transactions"):
            print("  (ไฟล์รุ่นเก่า schema v1: จำนวนหน่วยอยู่ในรายการธุรกรรม — เปิดด้วยแอปเพื่อแปลงเป็นยอดปัจจุบันอัตโนมัติ)")
        for h in data["holdings"]:
            if h.get("balance") is not None and h.get("units") is None:
                print(f"  - [{h['type']}] {h['name']} ยอดคงเหลือ {h['balance']} {h['currency']}")
            else:
                print(f"  - [{h['type']}] {h['name']} ({h.get('symbol') or '-'}) {h.get('units')} หน่วย × {h.get('price')} {h['currency']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
