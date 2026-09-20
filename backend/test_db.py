import sqlite3
import os

# Connect to the database
conn = sqlite3.connect("zkattend.db")
cursor = conn.cursor()

# Run the SELECT query
query = """
SELECT id, session_id, ap_count, threshold, is_valid, status
FROM wifi_templates
ORDER BY id DESC
LIMIT 3;
"""
cursor.execute(query)

# Fetch and print results
rows = cursor.fetchall()
for row in rows:
    print(row)

# Close connection
conn.close()
