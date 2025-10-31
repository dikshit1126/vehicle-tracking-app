from dotenv import load_dotenv
import os
load_dotenv()
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = os.environ["MONGODB_URL"]
DB_NAME = os.environ.get("MONGODB_DB", "vehicle_tracking")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]

def get_db():
    return db

async def check_mongo_connection():
    try:
        await client.admin.command('ping')
        return True
    except Exception:
        return False
