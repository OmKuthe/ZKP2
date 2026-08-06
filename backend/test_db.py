import sqlite3

conn = sqlite3.connect("zkattend.db")
cursor = conn.cursor()
cursor.execute("ALTER TABLE sessions ADD COLUMN environment_features TEXT;")
conn.commit()
conn.close()
