import sqlite3

conn = sqlite3.connect("zkattend.db")
cursor = conn.cursor()
cursor.execute("ALTER TABLE sessions ADD COLUMN hash_counter INTEGER DEFAULT 0;")
conn.commit()
conn.close()
