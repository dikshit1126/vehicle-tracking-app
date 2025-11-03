# MongoDB connection: see mongodb.py and .env for configuration
# Make sure to set MONGODB_URL and MONGODB_DB in .env
# Requires: pip install motor python-dotenv

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from mongodb import get_db
import uvicorn
import httpx

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class Coordinate(BaseModel):
    latitude: float
    longitude: float

class Route(BaseModel):
    route_id: Optional[int] = None
    name: str
    coordinates: List[Coordinate]
    distance: float
    duration: float
    created_at: Optional[datetime] = None

class VehiclePosition(BaseModel):
    vehicle_id: int
    latitude: float
    longitude: float
    timestamp: Optional[datetime] = None

class VehicleInfo(BaseModel):
    id: str
    name: str
    type: str
    company: str
    username: str

class RouteInfo(BaseModel):
    waypoints: list
    path: list
    distance: float
    duration: float

class StatusInfo(BaseModel):
    status: str
    live_location: str
    last_updated: str

class LoginInfo(BaseModel):
    username: str
    companyCode: str
    vehicleId: str
    login_time: str = datetime.utcnow().isoformat()

@app.post("/positions/")
async def save_position(position: VehiclePosition, db=Depends(get_db)):
    doc = position.dict()
    if not doc.get("timestamp"):
        doc["timestamp"] = datetime.utcnow()
    # Get live location name using correct lat/lon order
    url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={doc['latitude']}&lon={doc['longitude']}&accept-language=en"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = await resp.json()
                # Prefer suburb, village, town, city, county, state, or display_name for live_location
                address = data.get("address", {})
                doc["live_location"] = (
                    address.get("suburb") or
                    address.get("village") or
                    address.get("town") or
                    address.get("city") or
                    address.get("county") or
                    address.get("state") or
                    data.get("display_name") or
                    f"{doc['latitude']}, {doc['longitude']}"
                )
            else:
                doc["live_location"] = f"{doc['latitude']}, {doc['longitude']}"
        except Exception:
            doc["live_location"] = f"{doc['latitude']}, {doc['longitude']}"
    await db.vehicle_positions.insert_one(doc)
    return {"status": "Position saved successfully"}

@app.post("/positions/update/{vehicle_id}")
async def update_position(vehicle_id: str, request: Request, db=Depends(get_db)):
    data = await request.json()
    position = data.get("position")
    if not position or not isinstance(position, list) or len(position) != 2:
        raise HTTPException(status_code=400, detail="Invalid position format. Expected [lat, lon].")
    doc = {
        "vehicle_id": vehicle_id,
        "latitude": position[0],
        "longitude": position[1],
        "timestamp": datetime.utcnow()
    }
    await db.vehicle_positions.insert_one(doc)
    return {"status": "Position updated"}

@app.get("/positions/{vehicle_id}")
async def get_positions(vehicle_id: str, limit: int = 100, db=Depends(get_db)):
    cursor = db.vehicle_positions.find({"vehicle_id": vehicle_id}).sort("timestamp", -1).limit(limit)
    positions = []
    async for pos in cursor:
        pos["_id"] = str(pos["_id"])
        positions.append(pos)
    return positions

async def get_place_name(lat, lon):
    url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&accept-language=en"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        if resp.status_code == 200:
            data = await resp.json()
            return data.get("display_name", f"{lat}, {lon}")
        return f"{lat}, {lon}"

@app.get("/positions/latest/{vehicle_id}")
async def get_latest_position(vehicle_id: str, db=Depends(get_db)):
    pos = await db.vehicle_positions.find_one({"vehicle_id": vehicle_id}, sort=[("timestamp", -1)])
    if not pos:
        raise HTTPException(status_code=404, detail="No positions found for this vehicle")
    pos["_id"] = str(pos["_id"])
    # Try to get live_location from DB, fallback to lat/lon if not present
    live_location = pos.get("live_location")
    if not live_location:
        try:
            # Only try reverse geocoding if not present in DB
            url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={pos['latitude']}&lon={pos['longitude']}&accept-language=en"
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = await resp.json()
                    address = data.get("address", {})
                    live_location = (
                        address.get("suburb") or
                        address.get("village") or
                        address.get("town") or
                        address.get("city") or
                        address.get("county") or
                        address.get("state") or
                        data.get("display_name") or
                        f"{pos['latitude']}, {pos['longitude']}"
                    )
                else:
                    live_location = f"{pos['latitude']}, {pos['longitude']}"
        except Exception:
            live_location = f"{pos['latitude']}, {pos['longitude']}"
    pos["live_location"] = live_location
    return pos

@app.post("/vehicles/update/{vehicle_id}")
async def update_vehicle_info(vehicle_id: str, info: VehicleInfo, db=Depends(get_db)):
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": info.dict()}, upsert=True)
    return {"status": "Vehicle info updated"}

@app.post("/routes/update/{vehicle_id}")
async def update_route_info(vehicle_id: str, info: RouteInfo, db=Depends(get_db)):
    await db.routes.update_one({"vehicle_id": vehicle_id}, {"$set": info.dict()}, upsert=True)
    return {"status": "Route info updated"}

@app.post("/status/update/{vehicle_id}")
async def update_status_info(vehicle_id: str, info: StatusInfo, db=Depends(get_db)):
    await db.status.update_one({"vehicle_id": vehicle_id}, {"$set": info.dict()}, upsert=True)
    return {"status": "Status info updated"}

@app.post("/login")
async def save_login(info: LoginInfo, db=Depends(get_db)):
    await db.logins.insert_one(info.dict())
    return {"status": "Login info saved"}

@app.get("/logins")
async def get_logins(db=Depends(get_db)):
    cursor = db.logins.find().sort("login_time", -1)
    logins = []
    async for login in cursor:
        login["_id"] = str(login["_id"])
        logins.append(login)
    return logins

@app.get("/")
def read_root():
    return {"message": "Vehicle Tracking API is running."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
