import sqlite3
import asyncio
from datetime import datetime, date

async def fix_internships():
    conn = sqlite3.connect('zkattend.db')
    cursor = conn.cursor()
    
    # Update all internships to active status
    cursor.execute("UPDATE internships SET status = 'active'")
    conn.commit()
    
    # Check what we have
    cursor.execute("SELECT internship_id, role_name, start_date, end_date, status FROM internships")
    internships = cursor.fetchall()
    
    print("Internships in database:")
    for intern in internships:
        print(f"  ID: {intern[0]}, Role: {intern[1]}, Status: {intern[4]}")
    
    conn.close()
    print("\n✅ All internships set to ACTIVE")

if __name__ == "__main__":
    asyncio.run(fix_internships())