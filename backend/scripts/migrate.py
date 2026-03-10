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

# 创建 questions 表（若不存在）
QUESTIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(36) PRIMARY KEY,
    knowledge_point_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    title VARCHAR(512) NOT NULL,
    options TEXT NOT NULL,
    correct_answer VARCHAR(32) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME,
    FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
"""

# 迁移 exam_questions：从 knowledge_point_id 改为 question_id
def migrate_exam_questions(cur):
    cur.execute("PRAGMA table_info(exam_questions)")
    cols = [r[1] for r in cur.fetchall()]
    if "question_id" in cols:
        return  # 已迁移
    if "knowledge_point_id" in cols:
        cur.execute("DROP TABLE IF EXISTS exam_questions")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS exam_questions (
            id VARCHAR(36) PRIMARY KEY,
            exam_id VARCHAR(36) NOT NULL,
            question_id VARCHAR(36) NOT NULL,
            user_answer VARCHAR(64),
            is_correct BOOLEAN DEFAULT 0,
            FOREIGN KEY (exam_id) REFERENCES exam_records(id),
            FOREIGN KEY (question_id) REFERENCES questions(id)
        )
    """)


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
    cur.execute(QUESTIONS_TABLE_SQL)
    migrate_exam_questions(cur)
    conn.commit()
    conn.close()
    print("迁移完成")


if __name__ == "__main__":
    migrate()
