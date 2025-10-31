import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")

async def test():
    print("🔗 Connecting to MongoDB...")
    try:
        client = AsyncIOMotorClient(MONGODB_URL, tlsCAFile=certifi.where())
        await client.admin.command("ping")
        print("✅ MongoDB connection successful!")
    except Exception as e:
        print("❌ MongoDB connection failed:", e)

if __name__ == "__main__":
    asyncio.run(test())