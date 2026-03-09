"""数据库迁移：为已有表添加新列（若不存在）"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "shike.db")

MIGRATIONS = [
    ("users", "wechat_openid", "VARCHAR(64)"),
    ("users", "wechat_unionid", "VARCHAR(64)"),
    ("users", "has_onboarded", "BOOLEAN DEFAULT 0"),
    ("categories", "price", "INTEGER"),
]


def migrate():
    if not os.path.exists(DB_PATH):
        print("数据库不存在，无需迁移")
        return
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    for table, col, typ in MIGRATIONS:
        cur.execute(f"PRAGMA table_info({table})")
        cols = [r[1] for r in cur.fetchall()]
        if col not in cols:
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typ}")
                print(f"已添加 {table}.{col}")
            except Exception as e:
                print(f"跳过 {table}.{col}: {e}")
    conn.commit()
    conn.close()
    print("迁移完成")


if __name__ == "__main__":
    migrate()
